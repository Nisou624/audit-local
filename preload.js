const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('window-toggle-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowDrag: () => ipcRenderer.invoke('window-drag'),

  // Configuration
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getAppRootPath: () => ipcRenderer.invoke('get-app-root-path'),

  // Admin privileges
  checkAdminPrivileges: () => ipcRenderer.invoke('check-admin-privileges'),

  // File system operations
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  startEnhancedWatching: (dirPath) => ipcRenderer.invoke('start-enhanced-watching', dirPath),
  stopWatching: () => ipcRenderer.invoke('stop-watching'),
  
  // File operations
  createFile: (filePath, content, isAuthenticated) => ipcRenderer.invoke('create-file', filePath, content, isAuthenticated),
  createDirectory: (dirPath, isAuthenticated) => ipcRenderer.invoke('create-directory', dirPath, isAuthenticated),
  deleteItem: (itemPath, isAuthenticated) => ipcRenderer.invoke('delete-item', itemPath, isAuthenticated),
  renameItem: (oldPath, newPath, isAuthenticated) => ipcRenderer.invoke('rename-item', oldPath, newPath, isAuthenticated),
  
  // File reading and downloading
  readFileContents: (filePath) => ipcRenderer.invoke('read-file-contents', filePath),
  downloadFile: (filePath) => ipcRenderer.invoke('download-file', filePath),
  
  // Authentication
  authenticateAdmin: (password) => ipcRenderer.invoke('authenticate-admin', password),

  // File operations (restricted)
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  openFolderExternal: (folderPath) => ipcRenderer.invoke('open-folder-external', folderPath),
  verifyPath: (dirPath) => ipcRenderer.invoke('verify-path', dirPath),

  // Event listeners
  onFileSystemChange: (callback) => {
    ipcRenderer.on('file-system-change', (event, data) => callback(data));
  },
  onConfigLoaded: (callback) => {
    ipcRenderer.on('config-loaded', (event, config) => callback(config));
  }
});

