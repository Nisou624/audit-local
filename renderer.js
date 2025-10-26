// FileIcons utility class
class FileIcons {
  static getIcon(item) {
    if (item.isDirectory) {
      return '📁';
    }

    const extension = item.extension.toLowerCase();
    
    switch (extension) {
      case 'txt':
      case 'md':
      case 'readme':
        return '📄';
      
      case 'doc':
      case 'docx':
        return '📝';
      
      case 'xls':
      case 'xlsx':
      case 'csv':
        return '📊';
      
      case 'pdf':
        return '📕';
      
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'svg':
        return '🖼️';
      
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'mkv':
        return '🎬';
      
      case 'mp3':
      case 'wav':
      case 'flac':
        return '🎵';
      
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
        return '📦';
      
      case 'js':
      case 'html':
      case 'css':
      case 'json':
      case 'xml':
        return '💻';
      
      default:
        return '📄';
    }
  }
}

class FileExplorerApp {
  constructor() {
    this.currentPath = '';
    this.rootPath = '';
    this.config = null;
    this.isAuthenticated = false;
    this.fileList = [];
    this.init();
  }

  async init() {
    await this.loadConfiguration();
    this.bindEvents();
    this.setupKeyboardShortcuts();
    this.initializeExplorer();
  }

  async loadConfiguration() {
    try {
      this.config = await window.electronAPI.loadConfig();
      this.rootPath = this.config.explorer.defaultPath;
      this.applyConfiguration();
    } catch (error) {
      console.error('Failed to load configuration:', error);
      // Use defaults if config fails
      this.config = {
        explorer: { defaultPath: './sample-folder', autoRefresh: true },
        app: { showConfigButton: true },
        security: { requireAdminForModifications: false }
      };
      this.rootPath = this.config.explorer.defaultPath;
    }
  }

  applyConfiguration() {
    // Hide config button if configured
    if (!this.config.app.showConfigButton) {
      document.getElementById('btnSettings').style.display = 'none';
    }

    // Apply background image
    if (this.config.ui?.backgroundImage) {
      const bgElement = document.querySelector('.background-gradient');
      bgElement.style.backgroundImage = `url('${this.config.ui.backgroundImage}')`;
    }
  }

  bindEvents() {
    // Settings modal events
    document.getElementById('btnSettings').addEventListener('click', () => this.showSettings());
    document.getElementById('btnCloseModal').addEventListener('click', () => this.hideSettings());
    document.getElementById('btnCancel').addEventListener('click', () => this.hideSettings());
    document.getElementById('btnSave').addEventListener('click', () => this.saveSettings());
    
    // Navigation events
    document.getElementById('btnRefresh').addEventListener('click', () => this.refreshDirectory());
    document.getElementById('btnParent').addEventListener('click', () => this.goToParent());
    document.getElementById('btnHome').addEventListener('click', () => this.goToRoot());
    document.getElementById('btnBrowse').addEventListener('click', () => this.browseDirectory());
    document.getElementById('btnOpenExternal').addEventListener('click', () => this.openInSystemExplorer());

    // Add file operation buttons to navigation
    this.addFileOperationButtons();

    // Listen for real-time file system changes
    window.electronAPI.onFileSystemChange((data) => {
      this.handleFileSystemChange(data);
    });

    // Config loaded event
    window.electronAPI.onConfigLoaded((config) => {
      this.config = config;
      this.rootPath = config.explorer.defaultPath;
      this.applyConfiguration();
    });

    // Modal overlay click to close
    document.getElementById('modalSettings').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hideSettings();
      }
    });
  }

  addFileOperationButtons() {
    const navButtons = document.querySelector('.nav-buttons');
    
    // Check if buttons already exist
    if (document.getElementById('btnNewFile')) {
      return;
    }
    
    // Add file/folder creation buttons
    const createFileBtn = document.createElement('button');
    createFileBtn.className = 'btn-nav';
    createFileBtn.id = 'btnNewFile';
    createFileBtn.innerHTML = '<span>📄</span><span>Nouveau fichier</span>';
    createFileBtn.title = 'Créer un nouveau fichier';
    createFileBtn.addEventListener('click', () => this.createNewFile());

    const createFolderBtn = document.createElement('button');
    createFolderBtn.className = 'btn-nav';
    createFolderBtn.id = 'btnNewFolder';
    createFolderBtn.innerHTML = '<span>📁</span><span>Nouveau dossier</span>';
    createFolderBtn.title = 'Créer un nouveau dossier';
    createFolderBtn.addEventListener('click', () => this.createNewFolder());

    navButtons.appendChild(createFileBtn);
    navButtons.appendChild(createFolderBtn);
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Config shortcut (Ctrl+Comma by default)
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        this.showSettings();
      }
      
      // Refresh (F5)
      if (e.key === 'F5') {
        e.preventDefault();
        this.refreshDirectory();
      }
      
      // Parent directory (Alt+Up)
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        this.goToParent();
      }
    });
  }

  async initializeExplorer() {
    const defaultPath = this.config.explorer.defaultPath || './sample-folder';
    await this.navigateToDirectory(defaultPath);
  }

  async navigateToDirectory(path) {
    try {
      this.showLoading();
      
      const result = await window.electronAPI.readDirectory(path);
      
      if (result.success) {
        this.currentPath = result.path;
        this.fileList = result.items;
        this.updateUI();
        
        // Start enhanced file watching if auto-refresh is enabled
        if (this.config.explorer.autoRefresh) {
          await window.electronAPI.startEnhancedWatching(path);
        }
      } else {
        this.showError(result.error);
      }
    } catch (error) {
      this.showError('Erreur lors de la navigation: ' + error.message);
    }
  }

  handleFileSystemChange(data) {
    const { action, item, path: itemPath, timestamp } = data;
    
    switch (action) {
      case 'add':
        if (item) {
          // Check if item already exists to avoid duplicates
          const exists = this.fileList.find(f => f.path === item.path);
          if (!exists) {
            this.fileList.push(item);
            this.updateFileList();
            this.showNotification(`✅ ${item.isDirectory ? 'Dossier' : 'Fichier'} ajouté: ${item.name}`, 'success');
          }
        }
        break;
        
      case 'remove':
        this.fileList = this.fileList.filter(f => f.path !== itemPath);
        this.updateFileList();
        this.showNotification(`🗑️ Élément supprimé: ${this.getBasename(itemPath)}`, 'warning');
        break;
        
      case 'change':
        if (item) {
          const index = this.fileList.findIndex(f => f.path === item.path);
          if (index !== -1) {
            this.fileList[index] = item;
            this.updateFileList();
            this.showNotification(`📝 Fichier modifié: ${item.name}`, 'info');
          }
        }
        break;
    }
    
    // Update sync indicator
    this.updateSyncIndicator();
  }

  updateUI() {
    this.updateCurrentPath();
    this.updateFileList();
    this.updateNavigationButtons();
    this.updateSyncIndicator();
    this.hideLoading();
  }

  updateCurrentPath() {
    document.getElementById('currentPath').textContent = this.currentPath;
  }

  updateFileList() {
    const fileListElement = document.getElementById('fileList');
    const itemCount = document.getElementById('itemCount');
    
    // Sort files: directories first, then by name
    const sortedFiles = [...this.fileList].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    if (sortedFiles.length === 0) {
      fileListElement.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📭</span>
          <p>Ce dossier est vide</p>
        </div>
      `;
    } else {
      fileListElement.innerHTML = sortedFiles.map(item => 
        this.createFileItemHTML(item)
      ).join('');
    }

    itemCount.textContent = `${sortedFiles.length} élément${sortedFiles.length !== 1 ? 's' : ''}`;

    // Bind click events to file items
    this.bindFileItemEvents();
  }

  createFileItemHTML(item) {
    const icon = FileIcons.getIcon(item);
    const size = item.isDirectory ? '' : this.formatFileSize(item.size);
    const date = new Date(item.modified).toLocaleDateString('fr-FR');
    
    return `
      <div class="file-item" data-path="${item.path}" data-is-directory="${item.isDirectory}">
        <div class="file-icon clickable-file">${icon}</div>
        <div class="file-info">
          <div class="file-name clickable-file">${item.name}</div>
          <div class="file-details">
            ${size ? `<div class="file-size">📏 ${size}</div>` : ''}
            <div class="file-date">📅 ${date}</div>
          </div>
        </div>
        <div class="file-actions">
          <button class="action-btn rename-btn" data-path="${item.path}" title="Renommer">
            ✏️
          </button>
          <button class="action-btn delete-btn" data-path="${item.path}" title="Supprimer">
            🗑️
          </button>
        </div>
      </div>
    `;
  }

  bindFileItemEvents() {
    // Navigation clicks
    document.querySelectorAll('.clickable-file').forEach(element => {
      element.addEventListener('click', (e) => {
        const fileItem = e.target.closest('.file-item');
        const path = fileItem.dataset.path;
        const isDirectory = fileItem.dataset.isDirectory === 'true';
        
        if (isDirectory) {
          this.navigateToDirectory(path);
        } else {
          window.electronAPI.openFile(path);
        }
      });
    });

    // Action buttons
    document.querySelectorAll('.rename-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.renameItem(btn.dataset.path);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteItem(btn.dataset.path);
      });
    });
  }

  async createNewFile() {
    if (await this.checkAdminAuth()) {
      const fileName = prompt('Nom du nouveau fichier:');
      if (fileName && fileName.trim()) {
        const filePath = this.joinPath(this.currentPath, fileName.trim());
        const result = await window.electronAPI.createFile(filePath, '', this.isAuthenticated);
        
        if (result.success) {
          this.showNotification('📄 Fichier créé avec succès', 'success');
        } else {
          this.showNotification('❌ ' + result.error, 'error');
        }
      }
    }
  }

  async createNewFolder() {
    if (await this.checkAdminAuth()) {
      const folderName = prompt('Nom du nouveau dossier:');
      if (folderName && folderName.trim()) {
        const folderPath = this.joinPath(this.currentPath, folderName.trim());
        const result = await window.electronAPI.createDirectory(folderPath, this.isAuthenticated);
        
        if (result.success) {
          this.showNotification('📁 Dossier créé avec succès', 'success');
        } else {
          this.showNotification('❌ ' + result.error, 'error');
        }
      }
    }
  }

  async deleteItem(itemPath) {
    if (await this.checkAdminAuth()) {
      const itemName = this.getBasename(itemPath);
      if (confirm(`Êtes-vous sûr de vouloir supprimer "${itemName}" ?`)) {
        const result = await window.electronAPI.deleteItem(itemPath, this.isAuthenticated);
        
        if (result.success) {
          this.showNotification('🗑️ Élément supprimé avec succès', 'success');
        } else {
          this.showNotification('❌ ' + result.error, 'error');
        }
      }
    }
  }

  async renameItem(itemPath) {
    if (await this.checkAdminAuth()) {
      const currentName = this.getBasename(itemPath);
      const newName = prompt('Nouveau nom:', currentName);
      
      if (newName && newName.trim() && newName !== currentName) {
        const newPath = this.joinPath(this.getDirname(itemPath), newName.trim());
        const result = await window.electronAPI.renameItem(itemPath, newPath, this.isAuthenticated);
        
        if (result.success) {
          this.showNotification('✏️ Élément renommé avec succès', 'success');
        } else {
          this.showNotification('❌ ' + result.error, 'error');
        }
      }
    }
  }

  async checkAdminAuth() {
    if (!this.config.security.requireAdminForModifications) {
      return true;
    }
    
    if (!this.isAuthenticated) {
      const password = prompt('Mot de passe administrateur requis:');
      if (password) {
        const result = await window.electronAPI.authenticateAdmin(password);
        
        if (result.success) {
          this.isAuthenticated = true;
          this.showNotification('🔓 Authentifié avec succès', 'success');
          // Auto-logout after 5 minutes
          setTimeout(() => {
            this.isAuthenticated = false;
            this.showNotification('🔒 Session expirée', 'warning');
          }, 300000);
          return true;
        } else {
          this.showNotification('❌ ' + result.message, 'error');
          return false;
        }
      }
      return false;
    }
    
    return true;
  }

  updateNavigationButtons() {
    const parentBtn = document.getElementById('btnParent');
    const isRoot = this.isAtRoot();
    parentBtn.disabled = isRoot;
    
    if (isRoot) {
      parentBtn.style.opacity = '0.5';
      parentBtn.style.cursor = 'not-allowed';
    } else {
      parentBtn.style.opacity = '1';
      parentBtn.style.cursor = 'pointer';
    }
  }

  updateSyncIndicator() {
    const statusIcon = document.querySelector('.status-icon');
    const statusText = document.querySelector('.status-text');
    const lastUpdate = document.getElementById('lastUpdateTime');
    
    if (statusIcon) statusIcon.className = 'status-icon pulse';
    if (statusText) statusText.textContent = 'Synchronisé';
    if (lastUpdate) lastUpdate.textContent = new Date().toLocaleTimeString('fr-FR');
  }

  isAtRoot() {
    return this.currentPath === this.rootPath || this.currentPath.endsWith(this.rootPath);
  }

  async goToParent() {
    if (!this.isAtRoot()) {
      const parentPath = this.getDirname(this.currentPath);
      await this.navigateToDirectory(parentPath);
    }
  }

  async goToRoot() {
    await this.navigateToDirectory(this.rootPath);
  }

  async refreshDirectory() {
    await this.navigateToDirectory(this.currentPath);
  }

  async openInSystemExplorer() {
    await window.electronAPI.openFolderExternal(this.currentPath);
  }

  // Utility functions for path manipulation
  joinPath(dir, file) {
    if (dir.endsWith('/') || dir.endsWith('\\')) {
      return dir + file;
    }
    return dir + '/' + file;
  }

  getBasename(filePath) {
    return filePath.split(/[\\/]/).pop();
  }

  getDirname(filePath) {
    const parts = filePath.split(/[\\/]/);
    parts.pop();
    return parts.join('/');
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  showSettings() {
    const modal = document.getElementById('modalSettings');
    const rootPath = document.getElementById('inputRootPath');
    
    rootPath.value = this.config.explorer.defaultPath;
    modal.classList.add('active');
  }

  hideSettings() {
    const modal = document.getElementById('modalSettings');
    modal.classList.remove('active');
  }

  async saveSettings() {
    const rootPath = document.getElementById('inputRootPath').value;
    
    if (rootPath) {
      this.config.explorer.defaultPath = rootPath;
      this.rootPath = rootPath;
      const result = await window.electronAPI.saveConfig(this.config);
      
      if (result.success) {
        this.showNotification('⚙️ Paramètres sauvegardés', 'success');
        this.hideSettings();
        await this.navigateToDirectory(rootPath);
      } else {
        this.showNotification('❌ Erreur sauvegarde: ' + result.error, 'error');
      }
    }
  }

  async browseDirectory() {
    const result = await window.electronAPI.selectDirectory();
    
    if (result.success && !result.canceled) {
      document.getElementById('inputRootPath').value = result.path;
    }
  }

  showLoading() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    
    if (loadingSpinner) loadingSpinner.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
  }

  hideLoading() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) loadingSpinner.style.display = 'none';
  }

  showError(message) {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'flex';
    if (errorMessage) errorMessage.textContent = message;
  }

  showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const icon = document.getElementById('notificationIcon');
    const text = document.getElementById('notificationText');

    if (!notification || !icon || !text) return;

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    icon.textContent = icons[type] || icons.info;
    text.textContent = message;
    
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new FileExplorerApp();
});

