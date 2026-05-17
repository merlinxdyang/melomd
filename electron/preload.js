const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('LiteMDDesktop', {
  isDesktopApp: true,
  platform: process.platform,
  readAssetText: ref => ipcRenderer.invoke('litemd:read-asset-text', ref),
  readAssetDataUrl: ref => ipcRenderer.invoke('litemd:read-asset-data-url', ref),
  exportPDF: options => ipcRenderer.invoke('litemd:export-pdf', options || {})
});
