'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quadSpell', {
  load: () => ipcRenderer.invoke('board:load'),
  newDemand: () => ipcRenderer.invoke('board:new'),
  save: (demand, progressText) => ipcRenderer.invoke('board:save', demand, progressText),
  move: (id, quadrant) => ipcRenderer.invoke('board:move', id, quadrant),
  remove: id => ipcRenderer.invoke('board:remove', id),
  copySpell: id => ipcRenderer.invoke('board:copy-spell', id)
});
