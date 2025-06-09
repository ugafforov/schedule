const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  
  // Database operations
  dbQuery: (sql, params) => ipcRenderer.invoke('db-query', sql, params),
  dbRun: (sql, params) => ipcRenderer.invoke('db-run', sql, params),
  dbAll: (sql, params) => ipcRenderer.invoke('db-all', sql, params),
  dbGet: (sql, params) => ipcRenderer.invoke('db-get', sql, params),
  
  // Backup operations
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: (filePath) => ipcRenderer.invoke('import-data', filePath),
  
  // File operations
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
  saveFile: (defaultPath, filters) => ipcRenderer.invoke('save-file', defaultPath, filters)
});