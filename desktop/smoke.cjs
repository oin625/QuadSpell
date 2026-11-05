'use strict';

const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { newDemand } = require('./model.cjs');

let demands = [];
ipcMain.handle('board:load', () => ({ demands, error: null }));
ipcMain.handle('board:new', () => newDemand());
ipcMain.handle('board:save', (_event, demand) => {
  demands = [demand];
  return { ok: true, demands };
});
ipcMain.handle('board:move', () => ({ ok: true, demands }));
ipcMain.handle('board:remove', () => ({ ok: true, demands: [] }));
ipcMain.handle('board:copy-spell', () => ({ ok: true }));

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 1100,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.webContents.on('did-fail-load', (_event, code, description) => {
    process.stderr.write(`Page failed to load: ${code} ${description}\n`);
    app.exit(1);
  });
  await window.loadFile(path.join(__dirname, 'index.html'));
  try {
    const result = await window.webContents.executeJavaScript(`(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      const ready = document.getElementById('board') && typeof window.quadSpell.save === 'function';
      document.getElementById('add').click();
      await new Promise(resolve => setTimeout(resolve, 100));
      const opened = document.getElementById('editor').open;
      document.getElementById('title').value = '桌面运行检查';
      document.getElementById('intent').value = '保存一条示例需求';
      document.getElementById('save').click();
      await new Promise(resolve => setTimeout(resolve, 100));
      return { ready, opened, closed: !document.getElementById('editor').open,
               card: document.getElementById('board').textContent.includes('桌面运行检查') };
    })()`);
    if (!result.ready || !result.opened || !result.closed || !result.card) {
      throw new Error(`UI smoke failed: ${JSON.stringify(result)}`);
    }
    process.stdout.write('Desktop UI smoke passed\n');
    app.exit(0);
  } catch (error) {
    process.stderr.write(`${error.stack || error}\n`);
    app.exit(1);
  }
});
