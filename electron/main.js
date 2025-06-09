const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const OfflineDatabase = require('./database');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let database;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Maktab Dars Jadvali',
    show: false,
    titleBarStyle: 'default'
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database
  database = new OfflineDatabase();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (database) {
    database.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (database) {
    database.close();
  }
});

// IPC handlers for app operations
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

// Database operation handlers
ipcMain.handle('db-query', (event, sql, params) => {
  try {
    return database.query(sql, params);
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
});

ipcMain.handle('db-get', (event, sql, params) => {
  try {
    return database.get(sql, params);
  } catch (error) {
    console.error('Database get error:', error);
    throw error;
  }
});

ipcMain.handle('db-run', (event, sql, params) => {
  try {
    return database.run(sql, params);
  } catch (error) {
    console.error('Database run error:', error);
    throw error;
  }
});

// File operations
ipcMain.handle('select-file', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result.filePaths[0];
});

ipcMain.handle('save-file', async (event, defaultPath, filters) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: filters || [
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result.filePath;
});

// Backup operations
ipcMain.handle('export-data', async () => {
  try {
    const filePath = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'schedule-backup.db',
      filters: [
        { name: 'Database files', extensions: ['db'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (filePath.filePath) {
      await database.backup(filePath.filePath);
      return { success: true, path: filePath.filePath };
    }
    return { success: false, message: 'Export cancelled' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('import-data', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      await database.restore(filePath);
      return { success: true };
    }
    return { success: false, message: 'File not found' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});