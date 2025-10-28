// Admin Panel functionality
class AdminPanelManager {
  constructor(app) {
    this.app = app;
    this.dragCounter = 0;
  }

  setupDragAndDrop() {
    const dragZone = document.getElementById('dragDropZoneAdmin');
    if (!dragZone) return;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dragZone.addEventListener(eventName, this.preventDefaults.bind(this), false);
      document.body.addEventListener(eventName, this.preventDefaults.bind(this), false);
    });

    // Handle drag enter/leave to show/hide highlight
    dragZone.addEventListener('dragenter', this.handleDragEnter.bind(this), false);
    dragZone.addEventListener('dragleave', this.handleDragLeave.bind(this), false);
    dragZone.addEventListener('dragover', this.handleDragOver.bind(this), false);
    dragZone.addEventListener('drop', this.handleDrop.bind(this), false);
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  handleDragEnter(e) {
    this.dragCounter++;
    const dragZone = document.getElementById('dragDropZoneAdmin');
    dragZone.classList.add('highlight');
  }

  handleDragLeave(e) {
    this.dragCounter--;
    if (this.dragCounter === 0) {
      const dragZone = document.getElementById('dragDropZoneAdmin');
      dragZone.classList.remove('highlight');
    }
  }

  handleDragOver(e) {
    // Nothing specific needed here, just prevent default
  }

  async handleDrop(e) {
    this.dragCounter = 0;
    const dragZone = document.getElementById('dragDropZoneAdmin');
    dragZone.classList.remove('highlight');

    const dt = e.dataTransfer;
    const files = dt.files;

    await this.handleFiles(files);
  }

  async handleFiles(files) {
    if (!this.app.isAuthenticated) {
      this.app.showNotification('❌ Vous devez être connecté en tant qu\'administrateur', 'error');
      return;
    }

    for (let file of files) {
      await this.processFile(file);
    }
  }

  async processFile(file) {
    try {
      const filePath = this.app.joinPaths(this.app.currentPath, file.name);
      
      // Read file content
      const content = await this.readFileContent(file);
      
      // Create the file
      const result = await window.electronAPI.createFile(filePath, content, this.app.isAuthenticated);
      
      if (result.success) {
        this.app.showNotification(`📄 Fichier "${file.name}" ajouté avec succès`, 'success');
      } else {
        this.app.showNotification(`❌ Erreur lors de l'ajout de "${file.name}": ${result.error}`, 'error');
      }
    } catch (error) {
      this.app.showNotification(`❌ Erreur: ${error.message}`, 'error');
    }
  }

  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve(e.target.result);
      };
      
      reader.onerror = () => {
        reject(new Error('Erreur lors de la lecture du fichier'));
      };

      // Handle different file types
      if (file.type.startsWith('text/') || 
          file.name.endsWith('.txt') || 
          file.name.endsWith('.md') ||
          file.name.endsWith('.json') ||
          file.name.endsWith('.js') ||
          file.name.endsWith('.css') ||
          file.name.endsWith('.html')) {
        reader.readAsText(file);
      } else if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        // For binary files, read as array buffer and convert to base64
        reader.readAsArrayBuffer(file);
      }
    });
  }

  showFilePreview(filePath, extension) {
    // This would be expanded to show different previews for different file types
    // For now, we'll just open with the system default
    window.electronAPI.openFile(filePath);
  }

  async openFileForEditing(filePath, extension) {
    // This would be expanded to provide in-app editing for different file types
    switch (extension) {
      case 'txt':
      case 'md':
      case 'json':
      case 'js':
      case 'css':
      case 'html':
        // In a full implementation, this would open an in-app text editor
        await this.openTextEditor(filePath);
        break;
      case 'doc':
      case 'docx':
        // In a full implementation, this would open a document editor
        await this.openDocumentEditor(filePath);
        break;
      case 'xls':
      case 'xlsx':
        // In a full implementation, this would open a spreadsheet editor
        await this.openSpreadsheetEditor(filePath);
        break;
      case 'pdf':
        // In a full implementation, this would open a PDF viewer
        await this.openPDFViewer(filePath);
        break;
      default:
        // Fallback to system default
        await window.electronAPI.openFile(filePath);
        break;
    }
  }

  async openTextEditor(filePath) {
    // For now, open with system default
    // In a full implementation, you would create an in-app text editor modal
    await window.electronAPI.openFile(filePath);
    this.app.showNotification('📝 Ouverture de l\'éditeur de texte...', 'info');
  }

  async openDocumentEditor(filePath) {
    // For now, open with system default
    // In a full implementation, you would integrate a document editor
    await window.electronAPI.openFile(filePath);
    this.app.showNotification('📄 Ouverture de l\'éditeur de documents...', 'info');
  }

  async openSpreadsheetEditor(filePath) {
    // For now, open with system default
    // In a full implementation, you would integrate a spreadsheet editor
    await window.electronAPI.openFile(filePath);
    this.app.showNotification('📊 Ouverture de l\'éditeur de feuilles de calcul...', 'info');
  }

  async openPDFViewer(filePath) {
    // For now, open with system default
    // In a full implementation, you would create an in-app PDF viewer
    await window.electronAPI.openFile(filePath);
    this.app.showNotification('📕 Ouverture du visualiseur PDF...', 'info');
  }
}

// Initialize admin panel when app is ready
document.addEventListener('DOMContentLoaded', () => {
  if (window.app) {
    window.app.adminPanel = new AdminPanelManager(window.app);
    window.app.adminPanel.setupDragAndDrop();
  }
});

