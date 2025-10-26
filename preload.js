const { contextBridge, ipcRenderer } = require('electron');

// Exposer les APIs de manière sécurisée au renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Lire le contenu d'un dossier
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  
  // Ouvrir un fichier
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  
  // Ouvrir un dossier dans l'explorateur système
  openFolderExternal: (folderPath) => ipcRenderer.invoke('open-folder-external', folderPath),
  
  // Sélectionner un dossier via dialogue
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  // Vérifier un chemin
  verifyPath: (dirPath) => ipcRenderer.invoke('verify-path', dirPath),
  
  // Démarrer la surveillance
  startWatching: (dirPath) => ipcRenderer.invoke('start-watching', dirPath),
  
  // Arrêter la surveillance
  stopWatching: () => ipcRenderer.invoke('stop-watching'),
  
  // Obtenir le répertoire home
  getHomeDirectory: () => ipcRenderer.invoke('get-home-directory'),
  
  // Obtenir les dossiers communs
  getCommonDirectories: () => ipcRenderer.invoke('get-common-directories'),
  
  // Événements de surveillance (listeners)
  onFileAdded: (callback) => {
    ipcRenderer.on('file-added', (event, data) => callback(data));
  },
  
  onFileRemoved: (callback) => {
    ipcRenderer.on('file-removed', (event, data) => callback(data));
  },
  
  onFileChanged: (callback) => {
    ipcRenderer.on('file-changed', (event) => callback(data));
  },
  
  // Retirer les listeners
  removeFileListeners: () => {
    ipcRenderer.removeAllListeners('file-added');
    ipcRenderer.removeAllListeners('file-removed');
    ipcRenderer.removeAllListeners('file-changed');
  }
});

