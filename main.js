const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const chokidar = require('chokidar');

let mainWindow;
let fileWatcher = null;

// Créer la fenêtre principale
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    frame: true,
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'default',
    icon: path.join(__dirname, 'assets/icon.png')
  });

  mainWindow.loadFile('index.html');

  // Ouvrir DevTools en mode développement
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    if (fileWatcher) {
      fileWatcher.close();
    }
    mainWindow = null;
  });
}

// Lancer l'application
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================
// IPC HANDLERS - Communication avec le renderer
// ============================================

// Lire le contenu d'un dossier
ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    // Vérifier si le chemin existe
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error('Le chemin spécifié n\'est pas un dossier');
    }

    // Lire le contenu du dossier
    const items = await fs.readdir(dirPath);
    const itemsWithDetails = [];

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      try {
        const itemStats = await fs.stat(itemPath);
        
        itemsWithDetails.push({
          name: item,
          path: itemPath,
          isDirectory: itemStats.isDirectory(),
          size: itemStats.size,
          modified: itemStats.mtime.toISOString(),
          extension: path.extname(item).toLowerCase().replace('.', '')
        });
      } catch (err) {
        // Ignorer les fichiers inaccessibles
        console.error(`Erreur lecture ${item}:`, err.message);
      }
    }

    // Trier: dossiers d'abord, puis fichiers (alphabétique)
    itemsWithDetails.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      success: true,
      items: itemsWithDetails,
      path: dirPath
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Ouvrir un fichier avec l'application par défaut
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Ouvrir un dossier dans l'explorateur système
ipcMain.handle('open-folder-external', async (event, folderPath) => {
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Dialogue pour sélectionner un dossier
ipcMain.handle('select-directory', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Sélectionner un dossier'
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return {
      success: true,
      path: result.filePaths[0]
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Vérifier si un chemin existe et est accessible
ipcMain.handle('verify-path', async (event, dirPath) => {
  try {
    const stats = await fs.stat(dirPath);
    return {
      success: true,
      isDirectory: stats.isDirectory(),
      exists: true
    };
  } catch (error) {
    return {
      success: false,
      exists: false,
      error: error.message
    };
  }
});

// Démarrer la surveillance d'un dossier
ipcMain.handle('start-watching', async (event, dirPath) => {
  try {
    // Arrêter la surveillance précédente si elle existe
    if (fileWatcher) {
      await fileWatcher.close();
      fileWatcher = null;
    }

    // Créer un nouveau watcher avec chokidar
    fileWatcher = chokidar.watch(dirPath, {
      persistent: true,
      ignoreInitial: true,
      depth: 0, // Surveiller uniquement le dossier actuel (pas récursif)
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });

    // Événements de changement
    fileWatcher
      .on('add', (filePath) => {
        mainWindow?.webContents.send('file-added', {
          path: filePath,
          name: path.basename(filePath),
          type: 'file'
        });
      })
      .on('addDir', (dirPath) => {
        mainWindow?.webContents.send('file-added', {
          path: dirPath,
          name: path.basename(dirPath),
          type: 'directory'
        });
      })
      .on('unlink', (filePath) => {
        mainWindow?.webContents.send('file-removed', {
          path: filePath,
          name: path.basename(filePath),
          type: 'file'
        });
      })
      .on('unlinkDir', (dirPath) => {
        mainWindow?.webContents.send('file-removed', {
          path: dirPath,
          name: path.basename(dirPath),
          type: 'directory'
        });
      })
      .on('change', (filePath) => {
        mainWindow?.webContents.send('file-changed', {
          path: filePath,
          name: path.basename(filePath)
        });
      })
      .on('error', (error) => {
        console.error('Erreur watcher:', error);
      });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Arrêter la surveillance
ipcMain.handle('stop-watching', async (event) => {
  try {
    if (fileWatcher) {
      await fileWatcher.close();
      fileWatcher = null;
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Obtenir le répertoire home de l'utilisateur
ipcMain.handle('get-home-directory', async (event) => {
  try {
    const homeDir = app.getPath('home');
    return {
      success: true,
      path: homeDir
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Obtenir des dossiers système communs
ipcMain.handle('get-common-directories', async (event) => {
  try {
    return {
      success: true,
      directories: {
        home: app.getPath('home'),
        documents: app.getPath('documents'),
        downloads: app.getPath('downloads'),
        desktop: app.getPath('desktop'),
        pictures: app.getPath('pictures'),
        music: app.getPath('music'),
        videos: app.getPath('videos')
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

