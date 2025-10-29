// Enhanced FileIcons utility class with Windows system icons
class FileIcons {
  static getWindowsIcon(item) {
    if (item.isDirectory) {
      return this.createIconElement('folder');
    }

    const extension = item.extension.toLowerCase();
    
    const iconMap = {
      // Documents
      'txt': 'text',
      'rtf': 'text',
      'md': 'text',
      'doc': 'word',
      'docx': 'word',
      'xls': 'excel',
      'xlsx': 'excel',
      'csv': 'excel',
      'ppt': 'powerpoint',
      'pptx': 'powerpoint',
      'pdf': 'pdf',
      
      // Images
      'jpg': 'image',
      'jpeg': 'image',
      'png': 'image',
      'gif': 'image',
      'bmp': 'image',
      'svg': 'image',
      'ico': 'image',
      'tiff': 'image',
      'webp': 'image',
      
      // Videos
      'mp4': 'video',
      'avi': 'video',
      'mov': 'video',
      'mkv': 'video',
      'flv': 'video',
      'wmv': 'video',
      'webm': 'video',
      
      // Audio
      'mp3': 'audio',
      'wav': 'audio',
      'flac': 'audio',
      'ogg': 'audio',
      'wma': 'audio',
      'aac': 'audio',
      
      // Archives
      'zip': 'archive',
      'rar': 'archive',
      '7z': 'archive',
      'tar': 'archive',
      'gz': 'archive',
      
      // Code
      'js': 'code',
      'html': 'code',
      'css': 'code',
      'json': 'code',
      'xml': 'code',
      'php': 'code',
      'py': 'code',
      'java': 'code',
      'cpp': 'code',
      'c': 'code',
      'h': 'code',
      
      // Executables
      'exe': 'executable',
      'msi': 'executable',
      'bat': 'executable',
      'cmd': 'executable',
      'com': 'executable'
    };

    const iconType = iconMap[extension] || 'file';
    return this.createIconElement(iconType);
  }

  static createIconElement(iconType) {
    const iconClasses = {
      'folder': 'icon-folder',
      'word': 'icon-word',
      'excel': 'icon-excel',
      'powerpoint': 'icon-powerpoint',
      'pdf': 'icon-pdf',
      'image': 'icon-image',
      'video': 'icon-video',
      'audio': 'icon-audio',
      'archive': 'icon-archive',
      'code': 'icon-code',
      'text': 'icon-text',
      'executable': 'icon-executable',
      'file': 'icon-file'
    };

    return `<span class="file-icon-windows ${iconClasses[iconType] || iconClasses.file}"></span>`;
  }

  static getIcon(item) {
    return this.getWindowsIcon(item);
  }

  static canOpen(extension) {
    const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf', 'ppt', 'pptx'];
    return allowedExtensions.includes(extension.toLowerCase());
  }

  static canDownload(extension, isAdmin = false) {
    if (isAdmin) {
      // Admin can download everything except restricted system files
      const restrictedExtensions = ['exe', 'bat', 'cmd', 'com', 'msi'];
      return !restrictedExtensions.includes(extension.toLowerCase());
    }
    
    // Regular users: PDF download restricted, others allowed
    const downloadableExtensions = ['doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf', 'ppt', 'pptx'];
    return downloadableExtensions.includes(extension.toLowerCase());
  }

  static canPreview(extension) {
    const previewableExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'md', 'rtf', 'json', 'xml', 'html', 'css', 'js'];
    return previewableExtensions.includes(extension.toLowerCase());
  }

  static isPdfRestricted(extension, isAdmin = false) {
    // Admin users don't have PDF restrictions
    if (isAdmin) return false;
    return extension.toLowerCase() === 'pdf';
  }
}

class FileExplorerApp {
  constructor() {
    this.currentPath = '';
    this.rootPath = '';
    this.config = null;
    this.isAuthenticated = false;
    this.fileList = [];
    this.isAdmin = false;
    this.isAtRoot = false;
    this.init();
  }

  async init() {
    await this.loadConfiguration();
    await this.checkAdminStatus();
    this.bindEvents();
    this.setupKeyboardShortcuts();
    this.initializeExplorer();
    this.setupDragAndDrop();
  }

  async checkAdminStatus() {
    try {
      const result = await window.electronAPI.checkAdminPrivileges();
      this.isAdmin = result.isAdmin;
      console.log('Admin status:', this.isAdmin);
    } catch (error) {
      console.error('Failed to check admin status:', error);
      this.isAdmin = false;
    }
  }

  async loadConfiguration() {
    try {
      this.config = await window.electronAPI.loadConfig();
      this.rootPath = this.config.explorer.defaultPath;
      this.applyConfiguration();
    } catch (error) {
      console.error('Failed to load configuration:', error);
      this.config = {
        explorer: { defaultPath: './sample-folder', autoRefresh: true },
        app: { showConfigButton: true },
        security: { requireAdminForModifications: true, adminPassword: 'admin123' }
      };
      this.rootPath = this.config.explorer.defaultPath;
    }
  }

  applyConfiguration() {
    if (this.config.ui?.backgroundImage) {
      const bgElement = document.querySelector('.background-gradient');
      bgElement.style.backgroundImage = `url('${this.config.ui.backgroundImage}')`;
    }
  }

  bindEvents() {
    // Admin login events
    document.getElementById('btnAdminLogin').addEventListener('click', () => this.showAdminLogin());
    document.getElementById('btnCloseLoginModal').addEventListener('click', () => this.hideAdminLogin());
    document.getElementById('btnCancelLogin').addEventListener('click', () => this.hideAdminLogin());
    document.getElementById('btnLogin').addEventListener('click', () => this.handleAdminLogin());
    document.getElementById('btnDisconnect').addEventListener('click', () => this.handleAdminLogout());
    
    // Preview modal events
    document.getElementById('btnClosePreviewModal').addEventListener('click', () => this.hideFilePreview());
    
    // Custom dialog events
    this.bindCustomDialogEvents();
    
    // Navigation events - Normal mode
    document.getElementById('btnRefresh').addEventListener('click', () => this.refreshDirectory());
    document.getElementById('btnParent').addEventListener('click', () => this.goToParent());
    document.getElementById('btnHome').addEventListener('click', () => this.goToRoot());

    // Navigation events - Admin mode
    document.getElementById('btnRefreshAdmin').addEventListener('click', () => this.refreshDirectory());
    document.getElementById('btnParentAdmin').addEventListener('click', () => this.goToParent());
    document.getElementById('btnHomeAdmin').addEventListener('click', () => this.goToRoot());

    // Admin file operations
    document.getElementById('btnNewFolder').addEventListener('click', () => this.createNewFolder());

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
    document.getElementById('modalAdminLogin').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hideAdminLogin();
      }
    });

    document.getElementById('filePreviewModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hideFilePreview();
      }
    });

    // Enter key for login
    document.getElementById('inputAdminPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleAdminLogin();
      }
    });
  }

  // Custom dialog binding events
  bindCustomDialogEvents() {
    // Prompt dialog events
    document.getElementById('btnClosePromptModal').addEventListener('click', () => this.hideCustomPrompt());
    document.getElementById('btnCancelPrompt').addEventListener('click', () => this.hideCustomPrompt());
    document.getElementById('btnConfirmPrompt').addEventListener('click', () => this.confirmCustomPrompt());
    
    // Confirm dialog events
    document.getElementById('btnCloseConfirmModal').addEventListener('click', () => this.hideCustomConfirm());
    document.getElementById('btnCancelConfirm').addEventListener('click', () => this.hideCustomConfirm());
    document.getElementById('btnConfirmConfirm').addEventListener('click', () => this.confirmCustomConfirm());

    // Enter key for prompt
    document.getElementById('inputCustomPrompt').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.confirmCustomPrompt();
      }
    });

    // Modal overlay clicks
    document.getElementById('modalCustomPrompt').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hideCustomPrompt();
      }
    });

    document.getElementById('modalCustomConfirm').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hideCustomConfirm();
      }
    });
  }

  // Custom prompt dialog methods
  showCustomPrompt(title, label, placeholder = '', defaultValue = '') {
    return new Promise((resolve) => {
      this.promptResolve = resolve;
      
      document.getElementById('promptTitle').innerHTML = `<span>✏️</span> ${title}`;
      document.getElementById('promptLabel').textContent = label;
      document.getElementById('inputCustomPrompt').placeholder = placeholder;
      document.getElementById('inputCustomPrompt').value = defaultValue;
      
      document.getElementById('modalCustomPrompt').classList.add('active');
      document.getElementById('inputCustomPrompt').focus();
      document.getElementById('inputCustomPrompt').select();
    });
  }

  hideCustomPrompt() {
    document.getElementById('modalCustomPrompt').classList.remove('active');
    if (this.promptResolve) {
      this.promptResolve(null);
      this.promptResolve = null;
    }
  }

  confirmCustomPrompt() {
    const value = document.getElementById('inputCustomPrompt').value;
    document.getElementById('modalCustomPrompt').classList.remove('active');
    if (this.promptResolve) {
      this.promptResolve(value);
      this.promptResolve = null;
    }
  }

  // Custom confirm dialog methods
  showCustomConfirm(message) {
    return new Promise((resolve) => {
      this.confirmResolve = resolve;
      
      document.getElementById('confirmMessage').textContent = message;
      document.getElementById('modalCustomConfirm').classList.add('active');
    });
  }

  hideCustomConfirm() {
    document.getElementById('modalCustomConfirm').classList.remove('active');
    if (this.confirmResolve) {
      this.confirmResolve(false);
      this.confirmResolve = null;
    }
  }

  confirmCustomConfirm() {
    document.getElementById('modalCustomConfirm').classList.remove('active');
    if (this.confirmResolve) {
      this.confirmResolve(true);
      this.confirmResolve = null;
    }
  }

  // Fix #3: Improved drag and drop functionality
  setupDragAndDrop() {
    const dragDropZone = document.getElementById('dragDropZoneAdmin');
    
    if (!dragDropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dragDropZone.addEventListener(eventName, this.preventDefaults, false);
      document.body.addEventListener(eventName, this.preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dragDropZone.addEventListener(eventName, () => {
        dragDropZone.classList.add('highlight');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dragDropZone.addEventListener(eventName, () => {
        dragDropZone.classList.remove('highlight');
      }, false);
    });

    dragDropZone.addEventListener('drop', (e) => {
      this.handleDroppedFiles(e.dataTransfer.files);
    }, false);
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Fix #3: Fixed drag and drop file handling
  async handleDroppedFiles(files) {
    if (!this.isAuthenticated) {
      this.showNotification('❌ Vous devez être connecté en tant qu\'administrateur', 'error');
      return;
    }

    for (let file of files) {
      try {
        const filePath = this.joinPaths(this.currentPath, file.name);
        
        const reader = new FileReader();
        reader.onload = async (e) => {
          const result = await window.electronAPI.createFile(filePath, e.target.result, this.isAuthenticated);
          
          if (result.success) {
            this.showNotification(`📄 Fichier "${file.name}" ajouté avec succès`, 'success');
          } else {
            this.showNotification(`❌ Erreur lors de l'ajout de "${file.name}": ${result.error}`, 'error');
          }
        };
        
        // Read as ArrayBuffer for all files to handle binary properly
        reader.readAsArrayBuffer(file);
      } catch (error) {
        this.showNotification(`❌ Erreur: ${error.message}`, 'error');
      }
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F5') {
        e.preventDefault();
        this.refreshDirectory();
      }

      // Fix #6: F6 shortcut for dev folder opening
      if (e.key === 'F6') {
        e.preventDefault();
        this.openInSystemExplorer();
      }
      
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        this.goToParent();
      }

      if (e.ctrlKey && e.key === 'a' && !this.isAuthenticated) {
        e.preventDefault();
        this.showAdminLogin();
      }

      if (e.key === 'Escape') {
        this.hideFilePreview();
        this.hideAdminLogin();
        this.hideCustomPrompt();
        this.hideCustomConfirm();
      }
    });
  }

  async initializeExplorer() {
    const defaultPath = this.config.explorer.defaultPath || './sample-folder';
    await this.navigateToDirectory(defaultPath);
  }

  async navigateToDirectory(dirPath) {
    try {
      this.showLoading();
      
      const result = await window.electronAPI.readDirectory(dirPath);
      
      if (result.success) {
        this.currentPath = result.path;
        this.fileList = result.items;
        this.isAtRoot = result.isAtRoot || false;
        this.updateUI();
        
        if (this.config.explorer.autoRefresh) {
          await window.electronAPI.startEnhancedWatching(result.path);
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
  }

  updateUI() {
    this.updateFileList();
    this.updateNavigationButtons();
    this.hideLoading();
  }

  updateFileList() {
    const fileListElement = document.getElementById(this.isAuthenticated ? 'fileListAdmin' : 'fileList');
    const itemCount = document.getElementById(this.isAuthenticated ? 'itemCountAdmin' : 'itemCount');
    
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

    this.bindFileItemEvents();
  }

  createFileItemHTML(item) {
    const icon = FileIcons.getIcon(item);
    const size = item.isDirectory ? '' : this.formatFileSize(item.size);
    const date = new Date(item.modified).toLocaleDateString('fr-FR');
    const extension = item.extension.toLowerCase();
    
    // Create file action buttons based on file type and permissions
    let fileActions = '';
    if (!item.isDirectory) {
      const canOpen = FileIcons.canOpen(extension);
      const canDownload = FileIcons.canDownload(extension, this.isAuthenticated);
      const canPreview = FileIcons.canPreview(extension);
      const isPdfRestricted = FileIcons.isPdfRestricted(extension, this.isAuthenticated);

      let actionButtons = [];
      
      if (canPreview) {
        actionButtons.push(`<button class="action-btn preview-btn" data-path="${this.escapeHtml(item.path)}" title="Prévisualiser">👁️</button>`);
      }
      
      if (canOpen) {
        actionButtons.push(`<button class="action-btn open-btn" data-path="${this.escapeHtml(item.path)}" title="Ouvrir avec l'application par défaut">📖</button>`);
      }
      
      if (canDownload) {
        actionButtons.push(`<button class="action-btn download-btn" data-path="${this.escapeHtml(item.path)}" title="Télécharger">💾</button>`);
      } else if (isPdfRestricted && !this.isAuthenticated) {
        actionButtons.push(`<button class="action-btn download-btn disabled-btn" data-path="${this.escapeHtml(item.path)}" title="Téléchargement interdit - Données sensibles" disabled>💾</button>`);
      }

      if (actionButtons.length > 0) {
        fileActions = `<div class="file-actions">${actionButtons.join('')}</div>`;
      }
    }

    // Admin actions
    const adminActions = this.isAuthenticated ? `
      <div class="file-actions admin-actions">
        <button class="action-btn rename-btn" data-path="${this.escapeHtml(item.path)}" title="Renommer">✏️</button>
        <button class="action-btn delete-btn" data-path="${this.escapeHtml(item.path)}" title="Supprimer">🗑️</button>
      </div>
    ` : '';
    
    return `
      <div class="file-item" data-path="${this.escapeHtml(item.path)}" data-is-directory="${item.isDirectory}">
        <div class="file-icon clickable-file">${icon}</div>
        <div class="file-info">
            <div class="file-name clickable-file">${this.escapeHtml(item.name)}</div>
            <div class="file-details">
              ${size ? `<div class="file-size">📏 ${size}</div>` : ''}
              <div class="file-date">📅 ${date}</div>
            </div>
          </div>
          ${fileActions}
          ${adminActions}
        </div>
      `;
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    bindFileItemEvents() {
      // Fix #9: Single click for file operations
      document.querySelectorAll('.clickable-file').forEach(element => {
        element.addEventListener('click', (e) => {
          const fileItem = e.target.closest('.file-item');
          const filePath = fileItem.dataset.path;
          const isDirectory = fileItem.dataset.isDirectory === 'true';
          
          if (isDirectory) {
            this.navigateToDirectory(filePath);
          } else {
            // Fix #9: Single click behavior - preview for non-auth, open for auth
            const extension = filePath.split('.').pop().toLowerCase();
            const canOpen = FileIcons.canOpen(extension);
            const canPreview = FileIcons.canPreview(extension);
            
            if (this.isAuthenticated && canOpen) {
              // Admin users: open file directly
              this.openFile(filePath);
            } else if (canPreview) {
              // Regular users or non-openable files: show preview
              this.previewFile(filePath);
            }
          }
        });
      });

      // File action buttons
      document.querySelectorAll('.preview-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.previewFile(btn.dataset.path);
        });
      });

      document.querySelectorAll('.open-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openFile(btn.dataset.path);
        });
      });

      document.querySelectorAll('.download-btn:not(.disabled-btn)').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.downloadFile(btn.dataset.path);
        });
      });

      // Admin action buttons
      if (this.isAuthenticated) {
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
    }

    async previewFile(filePath) {
      try {
        const extension = filePath.split('.').pop().toLowerCase();
        const isPdfRestricted = FileIcons.isPdfRestricted(extension, this.isAuthenticated);

        this.showNotification('📄 Chargement de la prévisualisation...', 'info');
        
        const result = await window.electronAPI.readFileContents(filePath);
        
        if (result.success) {
          this.showFilePreviewModal(result, isPdfRestricted);
        } else {
          this.showNotification(`❌ Erreur lors de la prévisualisation: ${result.error}`, 'error');
        }
      } catch (error) {
        this.showNotification(`❌ Erreur: ${error.message}`, 'error');
      }
    }

    // Fix #8: Remove security warnings from preview modal
    showFilePreviewModal(fileData, isRestricted = false) {
      const modal = document.getElementById('filePreviewModal');
      const modalTitle = modal.querySelector('.modal-title');
      const modalContent = modal.querySelector('#previewContent');

      modalTitle.textContent = `Prévisualisation - ${fileData.name}`;

      let contentHTML = '';

      // Fix #5: PDF embed with printing disabled for regular users
      if (fileData.mimeType === 'application/pdf') {
        if (!this.isAuthenticated) {
          // For regular users, embed PDF without toolbar to prevent printing
          contentHTML += `
            <embed src="data:application/pdf;base64,${fileData.content}" 
                  type="application/pdf" 
                  width="100%" 
                  height="600px" 
                  toolbar="no"
                  statusbar="no"
                  menubar="no"
                  scrollbar="yes"
                  class="pdf-embed" />
          `;
        } else {
          // For admin users, allow full functionality
          contentHTML += `
            <embed src="data:application/pdf;base64,${fileData.content}" 
                  type="application/pdf" 
                  width="100%" 
                  height="600px" 
                  class="pdf-embed" />
          `;
        }
      } else if (fileData.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                fileData.mimeType === 'application/msword') {
        contentHTML += `
          <div class="document-preview">
            ${fileData.content}
          </div>
        `;
      } else if (fileData.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                fileData.mimeType === 'application/vnd.ms-excel' ||
                fileData.extension === 'csv') {
        contentHTML += `
          <div class="document-preview">
            ${fileData.content}
          </div>
        `;
      } else {
        contentHTML += `
          <pre class="file-content-preview">${this.escapeHtml(fileData.content)}</pre>
        `;
      }

      modalContent.innerHTML = contentHTML;
      modal.classList.add('active');
    }

    hideFilePreview() {
      const modal = document.getElementById('filePreviewModal');
      modal.classList.remove('active');
    }

    // Fix #4: Fixed docx file opening
    async openFile(filePath) {
      try {
        const result = await window.electronAPI.openFile(filePath, this.isAuthenticated);
        
        if (result.success) {
          this.showNotification(`📖 Ouverture du fichier: ${this.getBasename(filePath)}`, 'info');
        } else {
          this.showNotification(`❌ ${result.error}`, 'error');
        }
      } catch (error) {
        this.showNotification(`❌ Erreur: ${error.message}`, 'error');
      }
    }

    async downloadFile(filePath) {
      try {
        const extension = filePath.split('.').pop().toLowerCase();
        
        // Check permissions based on user type
        if (!FileIcons.canDownload(extension, this.isAuthenticated)) {
          if (this.isAuthenticated) {
            this.showNotification('🔒 Type de fichier système non téléchargeable', 'error');
          } else {
            this.showNotification('🔒 Téléchargement interdit pour les documents PDF - Données sensibles', 'error');
          }
          return;
        }

        const result = await window.electronAPI.downloadFile(filePath, this.isAuthenticated);
        
        if (result.success) {
          this.showNotification(`💾 Fichier téléchargé vers: ${this.getBasename(result.downloadPath)}`, 'success');
        } else {
          this.showNotification(`❌ ${result.error}`, 'error');
        }
      } catch (error) {
        this.showNotification(`❌ Erreur: ${error.message}`, 'error');
      }
    }

    // Admin login functions
    showAdminLogin() {
      if (this.isAuthenticated) {
        this.showAdminPanel();
        return;
      }
      
      const modal = document.getElementById('modalAdminLogin');
      const passwordInput = document.getElementById('inputAdminPassword');
      
      modal.classList.add('active');
      passwordInput.value = '';
      passwordInput.focus();
    }

    hideAdminLogin() {
      const modal = document.getElementById('modalAdminLogin');
      modal.classList.remove('active');
    }

    async handleAdminLogin() {
      const password = document.getElementById('inputAdminPassword').value;
      
      if (!password) {
        this.showNotification('❌ Veuillez entrer un mot de passe', 'error');
        return;
      }

      try {
        const result = await window.electronAPI.authenticateAdmin(password);
        
        if (result.success) {
          this.isAuthenticated = true;
          this.hideAdminLogin();
          this.showAdminPanel();
          this.hideNavPanel();
          this.showNotification('🔓 Connexion réussie - Mode Administrateur activé', 'success');
          
          this.updateUserStatus();
          
          // Auto-logout after 30 minutes
          setTimeout(() => {
            if (this.isAuthenticated) {
              this.handleAdminLogout();
              this.showNotification('🔒 Session administrateur expirée', 'warning');
            }
          }, 1800000);
        } else {
          this.showNotification('❌ Mot de passe incorrect', 'error');
        }
      } catch (error) {
        this.showNotification('❌ Erreur de connexion: ' + error.message, 'error');
      }
    }

    handleAdminLogout() {
      this.isAuthenticated = false;
      this.hideAdminPanel();
      this.showUserPanel();
      this.updateUserStatus();
      this.refreshDirectory();
      this.showNotification('🚪 Déconnexion réussie - Mode Consultation activé', 'info');
      this.showNavPanel();
    }

    showAdminPanel() {
      document.getElementById('fileTreeContainer').style.display = 'none';
      document.getElementById('adminPanel').style.display = 'flex';
      this.refreshDirectory();
    }

    hideNavPanel() {
      document.getElementById('admin-nav-section').style.display = 'none';
      document.getElementById('file-nav').style.display = 'none';
    }

    showNavPanel() {
      document.getElementById('admin-nav-section').style.display = 'flex';
      document.getElementById('file-nav').style.display = 'flex';
    }

    hideAdminPanel() {
      document.getElementById('adminPanel').style.display = 'none';
      document.getElementById('fileTreeContainer').style.display = 'flex';
    }

    showUserPanel() {
      this.hideAdminPanel();
    }

    updateUserStatus() {
      const loginBtn = document.getElementById('btnAdminLogin');
      
      if (this.isAuthenticated) {
        loginBtn.innerHTML = `
          <span>⚙️</span>
          <span>Panneau Admin</span>
        `;
      } else {
        loginBtn.innerHTML = `
          <span>🔐</span>
          <span>Connexion Admin</span>
        `;
      }
    }

    // Fix #7: Fixed new folder creation with custom prompt
    async createNewFolder() {
      if (!this.isAuthenticated) {
        this.showNotification('❌ Connexion administrateur requise', 'error');
        return;
      }

      try {
        const folderName = await this.showCustomPrompt(
          'Nouveau Dossier',
          'Nom du nouveau dossier:',
          'Nouveau dossier'
        );
        
        if (folderName && folderName.trim()) {
          const folderPath = this.joinPaths(this.currentPath, folderName.trim());
          
          const result = await window.electronAPI.createDirectory(folderPath, this.isAuthenticated);
          
          if (result.success) {
            this.showNotification('📁 Dossier créé avec succès', 'success');
          } else {
            this.showNotification('❌ ' + result.error, 'error');
          }
        }
      } catch (error) {
        this.showNotification('❌ Erreur lors de la création du dossier: ' + error.message, 'error');
      }
    }

    async deleteItem(itemPath) {
      if (!this.isAuthenticated) {
        this.showNotification('❌ Connexion administrateur requise', 'error');
        return;
      }

      try {
        const itemName = this.getBasename(itemPath);
        const confirmed = await this.showCustomConfirm(`Êtes-vous sûr de vouloir supprimer "${itemName}" ?`);
        
        if (confirmed) {
          const result = await window.electronAPI.deleteItem(itemPath, this.isAuthenticated);
          
          if (result.success) {
            this.showNotification('🗑️ Élément supprimé avec succès', 'success');
          } else {
            this.showNotification('❌ ' + result.error, 'error');
          }
        }
      } catch (error) {
        this.showNotification('❌ Erreur lors de la suppression: ' + error.message, 'error');
      }
    }

    // Fix #10: Fixed rename functionality with custom prompt
    async renameItem(itemPath) {
      if (!this.isAuthenticated) {
        this.showNotification('❌ Connexion administrateur requise', 'error');
        return;
      }

      try {
        const currentName = this.getBasename(itemPath);
        const newName = await this.showCustomPrompt(
          'Renommer',
          'Nouveau nom:',
          'Nouveau nom',
          currentName
        );
        
        if (newName && newName.trim() && newName !== currentName) {
          const newPath = this.joinPaths(this.getDirname(itemPath), newName.trim());
          
          const result = await window.electronAPI.renameItem(itemPath, newPath, this.isAuthenticated);
          
          if (result.success) {
            this.showNotification('✏️ Élément renommé avec succès', 'success');
          } else {
            this.showNotification('❌ ' + result.error, 'error');
          }
        }
      } catch (error) {
        this.showNotification('❌ Erreur lors du renommage: ' + error.message, 'error');
      }
    }

    updateNavigationButtons() {
      const parentBtn = document.getElementById(this.isAuthenticated ? 'btnParentAdmin' : 'btnParent');
      parentBtn.disabled = this.isAtRoot;
      
      if (this.isAtRoot) {
        parentBtn.style.opacity = '0.5';
        parentBtn.style.cursor = 'not-allowed';
      } else {
        parentBtn.style.opacity = '1';
        parentBtn.style.cursor = 'pointer';
      }
    }

    async goToParent() {
      if (!this.isAtRoot) {
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

    // Fix #6: Dev-only system explorer access via F6
    async openInSystemExplorer() {
      const result = await window.electronAPI.openFolderExternal(this.currentPath);
      if (!result.success) {
        this.showNotification('❌ ' + result.error, 'error');
      } else {
        this.showNotification('📂 Dossier ouvert dans l\'explorateur système', 'info');
      }
    }

    // Utility functions
    joinPaths(...parts) {
      return parts.filter(part => part && part.trim()).join('/').replace(/\/+/g, '/');
    }

    getBasename(filePath) {
      return filePath.split(/[\\/]/).pop() || '';
    }

    getDirname(filePath) {
      const parts = filePath.split(/[\\/]/);
      parts.pop();
      return parts.join('/') || filePath.charAt(0);
    }

    formatFileSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    showLoading() {
      const loadingSpinner = document.getElementById(this.isAuthenticated ? 'loadingSpinnerAdmin' : 'loadingSpinner');
      if (loadingSpinner) loadingSpinner.style.display = 'flex';
    }

    hideLoading() {
      const loadingSpinner = document.getElementById(this.isAuthenticated ? 'loadingSpinnerAdmin' : 'loadingSpinner');
      if (loadingSpinner) loadingSpinner.style.display = 'none';
    }

    showError(message) {
      const errorState = document.getElementById('errorState');
      const errorMessage = document.getElementById('errorMessage');
      
      this.hideLoading();
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
      }, 4000);
    }
  }

  // Initialize the app when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new FileExplorerApp();
  });

