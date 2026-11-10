'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quadSpell', {
  load: () => ipcRenderer.invoke('board:load'),
  newDemand: () => ipcRenderer.invoke('board:new'),
  save: (demand, progressText, expected, changeText) => ipcRenderer.invoke('board:save', demand, progressText, expected, changeText),
  listDrafts: () => ipcRenderer.invoke('draft:list'),
  saveDraft: draft => ipcRenderer.sendSync('draft:save', draft),
  removeDraft: key => ipcRenderer.sendSync('draft:remove', key),
  move: (id, quadrant) => ipcRenderer.invoke('board:move', id, quadrant),
  remove: (id, expected) => ipcRenderer.invoke('board:remove', id, expected),
  copySpell: id => ipcRenderer.invoke('board:copy-spell', id)
});
