const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  readDirectory: (path) => ipcRenderer.invoke('read-directory', path),
  openFile: (path) => ipcRenderer.invoke('open-file', path),
  openFolderExternal: (path) => ipcRenderer.invoke('open-folder-external', path),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  verifyPath: (path) => ipcRenderer.invoke('verify-path', path),
  
  // File watching
  startWatching: (path) => ipcRenderer.invoke('start-watching', path),
  startEnhancedWatching: (path) => ipcRenderer.invoke('start-enhanced-watching', path),
  stopWatching: () => ipcRenderer.invoke('stop-watching'),
  
  // System directories
  getHomeDirectory: () => ipcRenderer.invoke('get-home-directory'),
  getCommonDirectories: () => ipcRenderer.invoke('get-common-directories'),

  // Configuration
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // File operations
  createFile: (path, content, auth) => ipcRenderer.invoke('create-file', path, content, auth),
  createDirectory: (path, auth) => ipcRenderer.invoke('create-directory', path, auth),
  deleteItem: (path, auth) => ipcRenderer.invoke('delete-item', path, auth),
  renameItem: (oldPath, newPath, auth) => ipcRenderer.invoke('rename-item', oldPath, newPath, auth),

  // Authentication
  authenticateAdmin: (password) => ipcRenderer.invoke('authenticate-admin', password),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowToggleMaximize: () => ipcRenderer.invoke('window-toggle-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),

  // Event listeners
  onFileSystemChange: (callback) => {
    ipcRenderer.on('file-system-change', (event, data) => callback(data));
  },
  onConfigLoaded: (callback) => {
    ipcRenderer.on('config-loaded', (event, config) => callback(config));
  }
});

