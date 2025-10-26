const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const chokidar = require('chokidar');
const { spawn } = require('child_process');
const os = require('os');

// Import the configuration manager
const ConfigManager = require('./config-manager');
const configManager = new ConfigManager();

let mainWindow;
let fileWatcher = null;

// Helper function to generate file info
async function generateFileInfo(itemPath) {
  try {
    const itemStats = await fs.stat(itemPath);
    return {
      name: path.basename(itemPath),
      path: itemPath,
      isDirectory: itemStats.isDirectory(),
      size: itemStats.size,
      modified: itemStats.mtime.toISOString(),
      extension: path.extname(itemPath).toLowerCase().replace('.', '')
    };
  } catch (error) {
    return null;
  }
}

// Create the main window
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
    frame: false, // Hide default frame for custom titlebar
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, 'assets/icon.png')
  });

  mainWindow.loadFile('index.html');

  // Load and send config to renderer
  configManager.loadConfig().then(config => {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('config-loaded', config);
    });
  });

  // Open DevTools in development mode
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

// App initialization
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
// WINDOW CONTROL HANDLERS
// ============================================

ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-toggle-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

ipcMain.handle('window-drag', () => {
  // This function is called when the titlebar drag area is clicked
  // The actual dragging is handled by CSS -webkit-app-region: drag
  return { success: true };
});

// ============================================
// CONFIGURATION HANDLERS
// ============================================

ipcMain.handle('load-config', async () => {
  try {
    return await configManager.loadConfig();
  } catch (error) {
    console.error('Error loading config:', error);
    return {
      explorer: { defaultPath: './sample-folder', autoRefresh: true },
      app: { showConfigButton: true },
      security: { requireAdminForModifications: false }
    };
  }
});

ipcMain.handle('save-config', async (event, config) => {
  try {
    return await configManager.saveConfig(config);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================
// ADMIN PRIVILEGE HANDLERS
// ============================================

ipcMain.handle('check-admin-privileges', async () => {
  if (process.platform === 'win32') {
    try {
      // On Windows, try to access a system directory that requires admin
      const testPath = 'C:\\Windows\\System32\\config';
      await fs.access(testPath, fs.constants.R_OK);
      return { isAdmin: true };
    } catch (error) {
      return { isAdmin: false };
    }
  } else {
    // On Unix-like systems, check if running as root
    return { isAdmin: process.getuid && process.getuid() === 0 };
  }
});

ipcMain.handle('request-admin-privileges', async (event, operation, ...args) => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'Admin elevation only supported on Windows' });
      return;
    }

    // Create a PowerShell script to request elevation
    const script = `
      Start-Process -FilePath "${process.execPath}" -ArgumentList "${args.join(' ')}" -Verb RunAs -Wait
    `;

    const child = spawn('powershell.exe', ['-Command', script], {
      windowsHide: true
    });

    child.on('close', (code) => {
      resolve({ 
        success: code === 0, 
        message: code === 0 ? 'Operation completed with admin rights' : 'User cancelled or operation failed' 
      });
    });

    child.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
  });
});

// ============================================
// FILE SYSTEM HANDLERS
// ============================================

// Read directory contents
ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    // Normalize and resolve the path
    const resolvedPath = path.resolve(dirPath);
    
    // Check if path exists
    const stats = await fs.stat(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error('Le chemin spécifié n\'est pas un dossier');
    }

    // Read directory contents
    const items = await fs.readdir(resolvedPath);
    const itemsWithDetails = [];

    for (const item of items) {
      const itemPath = path.join(resolvedPath, item);
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
        console.error(`Erreur lecture ${item}:`, err.message);
      }
    }

    // Sort: directories first, then files (alphabetically)
    itemsWithDetails.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      success: true,
      items: itemsWithDetails,
      path: resolvedPath
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Enhanced file watching with immediate updates
ipcMain.handle('start-enhanced-watching', async (event, dirPath) => {
  try {
    // Stop previous watcher if it exists
    if (fileWatcher) {
      await fileWatcher.close();
      fileWatcher = null;
    }

    const resolvedPath = path.resolve(dirPath);
    
    fileWatcher = chokidar.watch(resolvedPath, {
      persistent: true,
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      },
      atomic: true,
      usePolling: false,
      interval: 500,
      binaryInterval: 1000
    });

    // Immediate response events
    fileWatcher
      .on('add', async (filePath) => {
        const result = await generateFileInfo(filePath);
        if (result) {
          mainWindow?.webContents.send('file-system-change', {
            action: 'add',
            item: result,
            timestamp: Date.now()
          });
        }
      })
      .on('addDir', async (dirPath) => {
        const result = await generateFileInfo(dirPath);
        if (result) {
          mainWindow?.webContents.send('file-system-change', {
            action: 'add',
            item: result,
            timestamp: Date.now()
          });
        }
      })
      .on('unlink', (filePath) => {
        mainWindow?.webContents.send('file-system-change', {
          action: 'remove',
          path: filePath,
          name: path.basename(filePath),
          timestamp: Date.now()
        });
      })
      .on('unlinkDir', (dirPath) => {
        mainWindow?.webContents.send('file-system-change', {
          action: 'remove',
          path: dirPath,
          name: path.basename(dirPath),
          timestamp: Date.now()
        });
      })
      .on('change', async (filePath) => {
        const result = await generateFileInfo(filePath);
        if (result) {
          mainWindow?.webContents.send('file-system-change', {
            action: 'change',
            item: result,
            timestamp: Date.now()
          });
        }
      })
      .on('error', (error) => {
        console.error('Erreur watcher:', error);
      });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Legacy file watching (keeping for compatibility)
ipcMain.handle('start-watching', async (event, dirPath) => {
  return ipcMain.handle('start-enhanced-watching')(event, dirPath);
});

// Stop file watching
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

// ============================================
// FILE OPERATIONS HANDLERS
// ============================================

// Create a new file
ipcMain.handle('create-file', async (event, filePath, content = '', isAuthenticated = false) => {
  try {
    const config = await configManager.loadConfig();
    
    if (config.security.requireAdminForModifications && !isAuthenticated) {
      return { success: false, error: 'Admin authentication required' };
    }

    const resolvedPath = path.resolve(filePath);
    await fs.writeFile(resolvedPath, content);
    return { success: true, message: 'File created successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create a new directory
ipcMain.handle('create-directory', async (event, dirPath, isAuthenticated = false) => {
  try {
    const config = await configManager.loadConfig();
    
    if (config.security.requireAdminForModifications && !isAuthenticated) {
      return { success: false, error: 'Admin authentication required' };
    }

    const resolvedPath = path.resolve(dirPath);
    await fs.mkdir(resolvedPath, { recursive: true });
    return { success: true, message: 'Directory created successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Delete an item (file or directory)
ipcMain.handle('delete-item', async (event, itemPath, isAuthenticated = false) => {
  try {
    const config = await configManager.loadConfig();
    
    if (config.security.requireAdminForModifications && !isAuthenticated) {
      return { success: false, error: 'Admin authentication required' };
    }

    const resolvedPath = path.resolve(itemPath);
    const stats = await fs.stat(resolvedPath);
    if (stats.isDirectory()) {
      await fs.rmdir(resolvedPath, { recursive: true });
    } else {
      await fs.unlink(resolvedPath);
    }
    
    return { success: true, message: 'Item deleted successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Rename an item
ipcMain.handle('rename-item', async (event, oldPath, newPath, isAuthenticated = false) => {
  try {
    const config = await configManager.loadConfig();
    
    if (config.security.requireAdminForModifications && !isAuthenticated) {
      return { success: false, error: 'Admin authentication required' };
    }

    const resolvedOldPath = path.resolve(oldPath);
    const resolvedNewPath = path.resolve(newPath);
    await fs.rename(resolvedOldPath, resolvedNewPath);
    return { success: true, message: 'Item renamed successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Enhanced file operations with UAC support
ipcMain.handle('create-file-elevated', async (event, filePath, content = '') => {
  try {
    const adminCheck = await ipcMain.handlers.get('check-admin-privileges')();
    
    if (!adminCheck.isAdmin) {
      // Request elevation
      const elevationResult = await ipcMain.handlers.get('request-admin-privileges')(event, 'create-file', filePath, content);
      return elevationResult;
    }

    const resolvedPath = path.resolve(filePath);
    await fs.writeFile(resolvedPath, content);
    return { success: true, message: 'File created successfully with admin privileges' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-item-elevated', async (event, itemPath) => {
  try {
    const adminCheck = await ipcMain.handlers.get('check-admin-privileges')();
    
    if (!adminCheck.isAdmin) {
      const elevationResult = await ipcMain.handlers.get('request-admin-privileges')(event, 'delete-item', itemPath);
      return elevationResult;
    }

    const resolvedPath = path.resolve(itemPath);
    const stats = await fs.stat(resolvedPath);
    if (stats.isDirectory()) {
      await fs.rmdir(resolvedPath, { recursive: true });
    } else {
      await fs.unlink(resolvedPath);
    }
    
    return { success: true, message: 'Item deleted successfully with admin privileges' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================
// AUTHENTICATION HANDLERS
// ============================================

// Admin authentication
ipcMain.handle('authenticate-admin', async (event, password) => {
  try {
    const config = await configManager.loadConfig();
    return {
      success: password === config.security.adminPassword,
      message: password === config.security.adminPassword ? 'Authenticated' : 'Invalid password'
    };
  } catch (error) {
    return { success: false, message: 'Authentication error' };
  }
});

// ============================================
// EXISTING HANDLERS (keeping for compatibility)
// ============================================

// Open file with default application
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    const resolvedPath = path.resolve(filePath);
    await shell.openPath(resolvedPath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Open folder in system explorer
ipcMain.handle('open-folder-external', async (event, folderPath) => {
  try {
    const resolvedPath = path.resolve(folderPath);
    await shell.openPath(resolvedPath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Directory selection dialog
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

// Verify path exists
ipcMain.handle('verify-path', async (event, dirPath) => {
  try {
    const resolvedPath = path.resolve(dirPath);
    const stats = await fs.stat(resolvedPath);
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

// Get user home directory
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

// Get common system directories
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

