const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const chokidar = require('chokidar');
const { spawn } = require('child_process');
const os = require('os');

// Import document processing libraries
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const csv = require('csv-parser');

// Import the configuration manager
const ConfigManager = require('./config-manager');
const configManager = new ConfigManager();

let mainWindow;
let fileWatcher = null;
let appRootPath = null; // Store the restricted root path

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

// Check if path is within allowed root directory
function isPathWithinRoot(targetPath, rootPath) {
  const normalizedTarget = path.resolve(targetPath);
  const normalizedRoot = path.resolve(rootPath);
  return normalizedTarget.startsWith(normalizedRoot);
}

// Process Office documents
async function processOfficeDocument(filePath, extension) {
  try {
    switch (extension) {
      case '.docx':
      case '.doc':
        const result = await mammoth.convertToHtml({ path: filePath });
        return {
          content: result.value,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };

      case '.xlsx':
      case '.xls':
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const htmlString = XLSX.utils.sheet_to_html(worksheet);
        return {
          content: htmlString,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };

      case '.csv':
        const csvData = await fs.readFile(filePath, 'utf8');
        const rows = csvData.split('\n').map(row => row.split(','));
        let tableHtml = '<table border="1" style="border-collapse: collapse; width: 100%;">';
        rows.forEach((row, index) => {
          const tag = index === 0 ? 'th' : 'td';
          tableHtml += '<tr>' + row.map(cell => `<${tag} style="padding: 8px; border: 1px solid #ddd;">${cell.trim()}</${tag}>`).join('') + '</tr>';
        });
        tableHtml += '</table>';
        return {
          content: tableHtml,
          mimeType: 'text/csv'
        };

      default:
        throw new Error('Unsupported document format');
    }
  } catch (error) {
    throw new Error(`Failed to process document: ${error.message}`);
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
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, 'assets/icon.png'),
    roundedCorners: false // Fix #1: Remove rounded corners for entire window
  });

  mainWindow.loadFile('index.html');

  // Load and send config to renderer
  configManager.loadConfig().then(config => {
    appRootPath = path.resolve(config.explorer.defaultPath);
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('config-loaded', config);
    });
  });

  // Open DevTools in development mode (F12 shortcut)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.openDevTools();
    }
  });

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
  return { success: true };
});

// ============================================
// CONFIGURATION HANDLERS
// ============================================

ipcMain.handle('load-config', async () => {
  try {
    const config = await configManager.loadConfig();
    appRootPath = path.resolve(config.explorer.defaultPath);
    return config;
  } catch (error) {
    console.error('Error loading config:', error);
    const defaultConfig = {
      explorer: { defaultPath: './sample-folder', autoRefresh: true },
      app: { showConfigButton: true },
      security: { requireAdminForModifications: true, adminPassword: 'admin123' }
    };
    appRootPath = path.resolve(defaultConfig.explorer.defaultPath);
    return defaultConfig;
  }
});

ipcMain.handle('save-config', async (event, config) => {
  try {
    return await configManager.saveConfig(config);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-app-root-path', async () => {
  return { success: true, rootPath: appRootPath };
});

// ============================================
// ADMIN PRIVILEGE HANDLERS
// ============================================

ipcMain.handle('check-admin-privileges', async () => {
  if (process.platform === 'win32') {
    try {
      const testPath = 'C:\\Windows\\System32\\config';
      await fs.access(testPath, fs.constants.R_OK);
      return { isAdmin: true };
    } catch (error) {
      return { isAdmin: false };
    }
  } else {
    return { isAdmin: process.getuid && process.getuid() === 0 };
  }
});

// ============================================
// FILE SYSTEM HANDLERS
// ============================================

// Read directory contents with path restriction
ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const resolvedPath = path.resolve(dirPath);
    
    // Ensure we stay within the app root directory
    if (!isPathWithinRoot(resolvedPath, appRootPath)) {
      return {
        success: false,
        error: 'Accès refusé: En dehors du dossier autorisé'
      };
    }
    
    const stats = await fs.stat(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error('Le chemin spécifié n\'est pas un dossier');
    }

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
      path: resolvedPath,
      isAtRoot: resolvedPath === appRootPath
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Read file contents for preview with Office document support
ipcMain.handle('read-file-contents', async (event, filePath) => {
  try {
    const resolvedPath = path.resolve(filePath);
    
    // Ensure we stay within the app root directory
    if (!isPathWithinRoot(resolvedPath, appRootPath)) {
      return {
        success: false,
        error: 'Accès refusé: En dehors du dossier autorisé'
      };
    }

    const stats = await fs.stat(resolvedPath);
    if (stats.isDirectory()) {
      return { success: false, error: 'Cannot read directory as file' };
    }

    const extension = path.extname(resolvedPath).toLowerCase();
    const fileSize = stats.size;

    // Check if file is too large (limit to 50MB)
    if (fileSize > 50 * 1024 * 1024) {
      return { success: false, error: 'Fichier trop volumineux pour la prévisualisation' };
    }

    let content;
    let mimeType = '';

    // Handle different file types
    switch (extension) {
      case '.txt':
      case '.md':
      case '.json':
      case '.js':
      case '.css':
      case '.html':
      case '.xml':
      case '.rtf':
        content = await fs.readFile(resolvedPath, 'utf8');
        mimeType = 'text/plain';
        break;

      case '.csv':
        try {
          const processedDoc = await processOfficeDocument(resolvedPath, extension);
          content = processedDoc.content;
          mimeType = processedDoc.mimeType;
        } catch (err) {
          // Fallback to plain text
          content = await fs.readFile(resolvedPath, 'utf8');
          mimeType = 'text/plain';
        }
        break;

      case '.docx':
      case '.doc':
      case '.xlsx':
      case '.xls':
        try {
          const processedDoc = await processOfficeDocument(resolvedPath, extension);
          content = processedDoc.content;
          mimeType = processedDoc.mimeType;
        } catch (err) {
          return { 
            success: false, 
            error: `Erreur lors du traitement du document: ${err.message}` 
          };
        }
        break;

      case '.pdf':
        // For PDFs, we'll read as buffer and convert to base64
        const pdfBuffer = await fs.readFile(resolvedPath);
        content = pdfBuffer.toString('base64');
        mimeType = 'application/pdf';
        break;

      default:
        return { success: false, error: 'Type de fichier non pris en charge pour la prévisualisation' };
    }

    return {
      success: true,
      content: content,
      mimeType: mimeType,
      extension: extension.substring(1),
      size: fileSize,
      name: path.basename(resolvedPath)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Download file with improved admin permissions
ipcMain.handle('download-file', async (event, filePath, isAuthenticated) => {
  try {
    const resolvedPath = path.resolve(filePath);
    
    // Ensure we stay within the app root directory
    if (!isPathWithinRoot(resolvedPath, appRootPath)) {
      return {
        success: false,
        error: 'Accès refusé: En dehors du dossier autorisé'
      };
    }

    const extension = path.extname(resolvedPath).toLowerCase();
    
    // SECURITY: Different rules for admin vs regular users
    if (!isAuthenticated) {
      // Regular users: Block PDF downloads (sensitive data)
      if (extension === '.pdf') {
        return {
          success: false,
          error: 'Téléchargement interdit pour les documents PDF - Données sensibles'
        };
      }

      // Only allow specific file types for download for regular users
      const allowedExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.rtf', '.ppt', '.pptx'];
      if (!allowedExtensions.includes(extension)) {
        return {
          success: false,
          error: 'Type de fichier non autorisé pour le téléchargement'
        };
      }
    } else {
      // Admin users: Block only dangerous system files
      const restrictedExtensions = ['.exe', '.bat', '.cmd', '.com', '.msi'];
      if (restrictedExtensions.includes(extension)) {
        return {
          success: false,
          error: 'Type de fichier système non autorisé pour le téléchargement'
        };
      }
    }

    const fileName = path.basename(resolvedPath);
    const downloadsPath = app.getPath('downloads');
    const destinationPath = path.join(downloadsPath, fileName);

    // Check if file already exists and create unique name if needed
    let finalDestinationPath = destinationPath;
    let counter = 1;
    while (fsSync.existsSync(finalDestinationPath)) {
      const ext = path.extname(fileName);
      const nameWithoutExt = path.basename(fileName, ext);
      finalDestinationPath = path.join(downloadsPath, `${nameWithoutExt} (${counter})${ext}`);
      counter++;
    }

    // Copy file
    await fs.copyFile(resolvedPath, finalDestinationPath);

    return {
      success: true,
      message: 'Fichier téléchargé avec succès',
      downloadPath: finalDestinationPath
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
    if (fileWatcher) {
      await fileWatcher.close();
      fileWatcher = null;
    }

    const resolvedPath = path.resolve(dirPath);
    
    // Ensure we stay within the app root directory
    if (!isPathWithinRoot(resolvedPath, appRootPath)) {
      return {
        success: false,
        error: 'Cannot watch directory outside of app root'
      };
    }
    
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
// FILE OPERATIONS HANDLERS (with path restriction)
// ============================================

// Create a new directory - FIXED
ipcMain.handle('create-directory', async (event, dirPath, isAuthenticated = false) => {
  try {
    const config = await configManager.loadConfig();
    
    // Only check admin requirement for non-authenticated users
    if (config.security.requireAdminForModifications && !isAuthenticated) {
      return { success: false, error: 'Admin authentication required' };
    }

    const resolvedPath = path.resolve(dirPath);
    
    // Ensure we stay within the app root directory
    if (!isPathWithinRoot(resolvedPath, appRootPath)) {
      return {
        success: false,
        error: 'Cannot create directory outside of app root directory'
      };
    }

    await fs.mkdir(resolvedPath, { recursive: true });
    return { success: true, message: 'Directory created successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Delete an item (file or directory) - FIXED
ipcMain.handle('delete-item', async (event, itemPath, isAuthenticated = false) => {
  try {
    const config = await configManager.loadConfig();
    
    // Only check admin requirement for non-authenticated users
    if (config.security.requireAdminForModifications && !isAuthenticated) {
      return { success: false, error: 'Admin authentication required' };
    }

    const resolvedPath = path.resolve(itemPath);
    
    // Ensure we stay within the app root directory and not deleting root itself
    if (!isPathWithinRoot(resolvedPath, appRootPath) || resolvedPath === appRootPath) {
      return {
        success: false,
        error: 'Cannot delete this item'
      };
    }

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

// Rename an item - FIXED
ipcMain.handle('rename-item', async (event, oldPath, newPath, isAuthenticated = false) => {
  try {
    const config = await configManager.loadConfig();
    
    // Only check admin requirement for non-authenticated users
    if (config.security.requireAdminForModifications && !isAuthenticated) {
      return { success: false, error: 'Admin authentication required' };
    }

    const resolvedOldPath = path.resolve(oldPath);
    const resolvedNewPath = path.resolve(newPath);
    
    // Ensure both paths are within the app root directory
    if (!isPathWithinRoot(resolvedOldPath, appRootPath) || 
        !isPathWithinRoot(resolvedNewPath, appRootPath) ||
        resolvedOldPath === appRootPath) {
      return {
        success: false,
        error: 'Cannot rename this item'
      };
    }

    await fs.rename(resolvedOldPath, resolvedNewPath);
    return { success: true, message: 'Item renamed successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create a file with drag and drop support - FIXED
ipcMain.handle('create-file', async (event, filePath, content = '', isAuthenticated = false) => {
  try {
    const config = await configManager.loadConfig();
    
    // Only check admin requirement for non-authenticated users
    if (config.security.requireAdminForModifications && !isAuthenticated) {
      return { success: false, error: 'Admin authentication required' };
    }

    const resolvedPath = path.resolve(filePath);
    
    // Ensure we stay within the app root directory
    if (!isPathWithinRoot(resolvedPath, appRootPath)) {
      return {
        success: false,
        error: 'Cannot create file outside of app root directory'
      };
    }

    // Handle different content types
    let fileContent = content;
    if (Buffer.isBuffer(content)) {
      fileContent = content;
    } else if (typeof content === 'string' && content.startsWith('data:')) {
      // Handle data URLs (from drag and drop)
      const base64Data = content.split(',')[1];
      fileContent = Buffer.from(base64Data, 'base64');
    } else if (typeof content === 'string') {
      fileContent = content;
    }

    await fs.writeFile(resolvedPath, fileContent);
    return { success: true, message: 'File created successfully' };
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
// FILE OPENING HANDLERS (improved for admin)
// ============================================

// Open file with improved admin permissions
ipcMain.handle('open-file', async (event, filePath, isAuthenticated) => {
  try {
    const resolvedPath = path.resolve(filePath);
    
    // Ensure we stay within the app root directory
    if (!isPathWithinRoot(resolvedPath, appRootPath)) {
      return {
        success: false,
        error: 'Access denied: Outside of allowed directory'
      };
    }

    const extension = path.extname(resolvedPath).toLowerCase();
    
    // Check if file type is allowed to be opened
    let allowedExtensions;
    if (isAuthenticated) {
      // Admin can open more file types
      allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.rtf', '.ppt', '.pptx', '.html', '.xml', '.json'];
    } else {
      // Regular users have limited access
      allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.rtf', '.ppt', '.pptx'];
    }
    
    if (!allowedExtensions.includes(extension)) {
      return {
        success: false,
        error: 'File type not supported for opening'
      };
    }

    await shell.openPath(resolvedPath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Open folder in system explorer (for dev debugging only - F6 shortcut)
ipcMain.handle('open-folder-external', async (event, folderPath) => {
  try {
    const resolvedPath = path.resolve(folderPath);
    
    // Ensure we stay within the app root directory
    if (!isPathWithinRoot(resolvedPath, appRootPath)) {
      return {
        success: false,
        error: 'Access denied: Outside of allowed directory'
      };
    }

    await shell.openPath(resolvedPath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Verify path exists (with restriction)
ipcMain.handle('verify-path', async (event, dirPath) => {
  try {
    const resolvedPath = path.resolve(dirPath);
    
    if (!isPathWithinRoot(resolvedPath, appRootPath)) {
      return {
        success: false,
        exists: false,
        error: 'Path outside of allowed directory'
      };
    }

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

