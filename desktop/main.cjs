'use strict';

const path = require('node:path');
const { app, BrowserWindow, clipboard, ipcMain, session } = require('electron');
const { DemandStorage } = require('./storage.cjs');
const { DraftStorage } = require('./drafts.cjs');
const { buildPrompt, newDemand } = require('./model.cjs');

app.setName('QuadSpell');
let storage;
let drafts;

function createWindow() {
  const window = new BrowserWindow({
    title: 'QuadSpell · 四象咒言',
    width: 1100,
    height: 800,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#f4f6fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  storage = new DemandStorage(path.join(app.getPath('userData'), 'demands.json'));
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  drafts = new DraftStorage(path.join(app.getPath('userData'), 'drafts.json'));
  ipcMain.handle('board:load', () => storage.load());
  ipcMain.handle('draft:list', () => { drafts.load(); return drafts.snapshot(); });
  // Synchronous local writes finish before the window can close or reload.
  ipcMain.on('draft:save', (event, draft) => { event.returnValue = drafts.save(draft); });
  ipcMain.on('draft:remove', (event, key) => { event.returnValue = drafts.remove(key); });
  ipcMain.handle('board:new', () => newDemand());
  ipcMain.handle('board:save', (_event, demand, progressText, expected, changeText) => storage.upsert(demand, progressText, expected, changeText));
  ipcMain.handle('board:move', (_event, id, quadrant) => storage.move(id, quadrant));
  ipcMain.handle('board:remove', (_event, id, expected) => storage.remove(id, expected));
  ipcMain.handle('board:copy-spell', (_event, id) => {
    storage.load();
    if (storage.loadError) return { ok: false, error: storage.loadError };
    const demand = storage.copyable(id);
    if (!demand) return { ok: false, error: '需求不存在' };
    if (!demand.spell.intent.trim()) return { ok: false, error: '请先填写咒言' };
    clipboard.writeText(buildPrompt(demand));
    return { ok: true };
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
