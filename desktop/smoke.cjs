'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const { newDemand, buildPrompt } = require('./model.cjs');
const { DemandStorage } = require('./storage.cjs');
const { DraftStorage } = require('./drafts.cjs');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quadspell-ui-'));
const file = path.join(directory, 'demands.json');
const storage = new DemandStorage(file);
const drafts = new DraftStorage(path.join(directory, 'drafts.json'));
let copied = '';
ipcMain.handle('board:load', () => storage.load());
ipcMain.handle('board:new', () => newDemand());
ipcMain.handle('board:save', (_event, demand, progress, expected, change) =>
  storage.upsert(demand, progress, expected, change));
ipcMain.handle('board:move', (_event, id, quadrant) => storage.move(id, quadrant));
ipcMain.handle('board:remove', (_event, id, expected) => storage.remove(id, expected));
ipcMain.handle('board:copy-spell', (_event, id) => {
  copied = buildPrompt(storage.copyable(id));
  return { ok: true };
});
ipcMain.handle('draft:list', () => { drafts.load(); return drafts.snapshot(); });
ipcMain.on('draft:save', (event, draft) => { event.returnValue = drafts.save(draft); });
ipcMain.on('draft:remove', (event, key) => { event.returnValue = drafts.remove(key); });

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false, width: 1100, height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  const errors = [];
  window.webContents.on('console-message', details => {
    if (details.level === 'error') errors.push(details.message);
  });
  const run = source => window.webContents.executeJavaScript(source);
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await run(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error('UI timed out: ' + expression);
  };
  const capture = async name => {
    if (!process.env.QUADSPELL_SMOKE_SCREENSHOTS) return;
    const output = process.env.QUADSPELL_SMOKE_SCREENSHOTS;
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, name + '.png'), (await window.webContents.capturePage()).toPNG());
  };
  try {
    await window.loadFile(path.join(__dirname, 'index.html'));
    await waitFor("document.getElementById('count').textContent === '0 项'");
    await run("document.getElementById('add').click()");
    await waitFor("document.getElementById('editor').open");
    await run("(() => { const set = (id, value) => { const field = document.getElementById(id); field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); }; set('code-entry', 'src/search.ts'); set('title', '桌面接续检查'); set('intent', '按时间排序'); set('new-progress', '排序已实现'); set('new-change', '相同时间保持输入顺序'); set('handoff-completed', '排序已实现'); set('handoff-pending', '验证相同时间排序'); set('handoff-verification', '空结果通过，回归尚未执行'); document.getElementById('cancel').click(); })()");
    assert.equal(new DraftStorage(drafts.filePath).drafts.new.changeText, '相同时间保持输入顺序');

    // Reload the renderer before restoring an unfinished new task.
    await window.reload();
    await waitFor("!document.getElementById('draft-picker').hidden");
    await run("document.getElementById('add').click()");
    await waitFor("document.getElementById('editor').open");
    assert.equal(await run("document.getElementById('new-change').value"), '相同时间保持输入顺序');
    await run("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))");
    await waitFor("!document.getElementById('editor').open && document.getElementById('board').textContent.includes('桌面接续检查')");
    assert.match(copied, /交接摘要/);
    assert.match(copied, /C001/);
    assert.match(copied, /回归尚未执行/);
    assert.equal(storage.demands[0].progress.length, 1);
    assert.deepEqual(new DraftStorage(drafts.filePath).drafts, {});

    nativeTheme.themeSource = 'light';
    await new Promise(resolve => setTimeout(resolve, 80));
    await capture('board-light');
    nativeTheme.themeSource = 'dark';
    await new Promise(resolve => setTimeout(resolve, 80));
    await capture('board-dark');

    await run("document.querySelector('.card').click()");
    await waitFor("document.getElementById('editor').open");
    await run("(() => { const field = document.getElementById('new-progress'); field.value = '相同时间排序检查失败'; field.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('cancel').click(); })()");
    await window.reload();
    await waitFor("!document.getElementById('draft-picker').hidden");
    await run("(() => { const picker = document.getElementById('draft-picker'); picker.value = picker.options[1].value; picker.dispatchEvent(new Event('change')); })()");
    await waitFor("document.getElementById('editor').open");
    assert.equal(await run("document.getElementById('new-progress').value"), '相同时间排序检查失败');
    await run("document.getElementById('handoff-pending').scrollIntoView()");
    await capture('editor-dark');
    nativeTheme.themeSource = 'light';
    await new Promise(resolve => setTimeout(resolve, 80));
    await capture('editor-light');
    await run("document.getElementById('save-copy').click()");
    await waitFor("!document.getElementById('editor').open");
    assert.equal(storage.demands[0].progress.length, 2);
    assert.equal(storage.demands[0].changes.length, 1);
    assert.match(copied, /摘要之后的新进度/);
    assert.match(copied, /相同时间排序检查失败/);

    await run("document.querySelector('.card').click()");
    await waitFor("document.getElementById('editor').open");
    await run("(() => { const field = document.getElementById('notes'); field.value = '未保存的本机草稿'; field.dispatchEvent(new Event('input', { bubbles: true })); })()");
    const external = new DemandStorage(file);
    const original = structuredClone(external.demands[0]);
    assert.equal(external.upsert({ ...original, notes: '外部更新应保留' }, '', original).ok, true);
    await run("document.getElementById('save').click()");
    await waitFor("document.getElementById('editor-error').textContent.includes('其他窗口')");
    assert.equal(await run("document.getElementById('editor').open"), true);
    assert.equal(new DemandStorage(file).demands[0].notes, '外部更新应保留');
    assert.equal(Object.values(new DraftStorage(drafts.filePath).drafts)[0].demand.notes, '未保存的本机草稿');
    await run("document.getElementById('cancel').click()");
    await run("document.querySelector('.card').click()");
    await waitFor("document.getElementById('editor').open");
    await run("document.getElementById('save').click()");
    await waitFor("document.getElementById('editor-error').textContent.includes('需求已发生变化')");
    await run("window.confirm = () => true; document.getElementById('discard').click()");
    assert.deepEqual(new DraftStorage(drafts.filePath).drafts, {});
    assert.equal(new DemandStorage(file).demands[0].notes, '外部更新应保留');
    assert.deepEqual(errors, []);
    process.stdout.write('Desktop UI smoke passed: draft reload, handoff, changes, copy, conflict, discard, light/dark\n');
    fs.rmSync(directory, { recursive: true, force: true });
    app.exit(0);
  } catch (error) {
    process.stderr.write((error.stack || error) + '\n');
    fs.rmSync(directory, { recursive: true, force: true });
    app.exit(1);
  }
});
