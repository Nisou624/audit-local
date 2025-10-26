// ================================================
// ÉTAT DE L'APPLICATION
// ================================================

let appState = {
  currentPath: '',
  rootPath: '',
  pathHistory: [],
  files: [],
  isWatching: false,
  lastUpdate: null
};

// ================================================
// ÉLÉMENTS DOM
// ================================================

const elements = {
  // Navigation
  currentPath: document.getElementById('currentPath'),
  btnParent: document.getElementById('btnParent'),
  btnHome: document.getElementById('btnHome'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnOpenExternal: document.getElementById('btnOpenExternal'),
  
  // Contenu
  fileList: document.getElementById('fileList'),
  itemCount: document.getElementById('itemCount'),
  loadingSpinner: document.getElementById('loadingSpinner'),
  emptyState: document.getElementById('emptyState'),
  errorState: document.getElementById('errorState'),
  errorMessage: document.getElementById('errorMessage'),
  
  // Sync indicator
  syncIndicator: document.getElementById('syncIndicator'),
  lastUpdateTime: document.getElementById('lastUpdateTime'),
  
  // Modal paramètres
  btnSettings: document.getElementById('btnSettings'),
  modalSettings: document.getElementById('modalSettings'),
  btnCloseModal: document.getElementById('btnCloseModal'),
  btnCancel: document.getElementById('btnCancel'),
  btnSave: document.getElementById('btnSave'),
  inputRootPath: document.getElementById('inputRootPath'),
  btnBrowse: document.getElementById('btnBrowse'),
  shortcuts: document.getElementById('shortcuts'),
  checkAutoRefresh: document.getElementById('checkAutoRefresh'),
  
  // Notification
  notification: document.getElementById('notification'),
  notificationIcon: document.getElementById('notificationIcon'),
  notificationText: document.getElementById('notificationText')
};

// ================================================
// INITIALISATION
// ================================================

async function init() {
  console.log('🚀 Initialisation de l\'application...');
  
  // Charger la configuration sauvegardée
  loadConfig();
  
  // Obtenir les dossiers communs pour les raccourcis
  await loadShortcuts();
  
  // Définir le chemin initial
  if (!appState.rootPath) {
    const result = await window.electronAPI.getHomeDirectory();
    if (result.success) {
      appState.rootPath = result.path;
      appState.currentPath = result.path;
    }
  }
  
  // Charger le contenu initial
  await loadDirectory(appState.currentPath);
  
  // Démarrer la surveillance si activée
  if (appState.isWatching) {
    await startWatching();
  }
  
  // Attacher les event listeners
  attachEventListeners();
  
  // Mettre à jour le timestamp
  updateTimestamp();
  
  showNotification('✅', 'Application prête!');
  console.log('✅ Application initialisée');
}

// ================================================
// CONFIGURATION
// ================================================

function loadConfig() {
  const config = localStorage.getItem('fileExplorerConfig');
  if (config) {
    try {
      const parsed = JSON.parse(config);
      appState.rootPath = parsed.rootPath || '';
      appState.currentPath = parsed.rootPath || '';
      appState.isWatching = parsed.autoRefresh !== false;
      
      elements.inputRootPath.value = appState.rootPath;
      elements.checkAutoRefresh.checked = appState.isWatching;
    } catch (err) {
      console.error('Erreur chargement config:', err);
    }
  }
}

function saveConfig() {
  const config = {
    rootPath: appState.rootPath,
    autoRefresh: appState.isWatching
  };
  localStorage.setItem('fileExplorerConfig', JSON.stringify(config));
}

// ================================================
// CHARGEMENT DES RACCOURCIS
// ================================================

async function loadShortcuts() {
  const result = await window.electronAPI.getCommonDirectories();
  if (result.success) {
    const dirs = result.directories;
    const shortcuts = [
      { icon: '🏠', label: 'Accueil', path: dirs.home },
      { icon: '📄', label: 'Documents', path: dirs.documents },
      { icon: '⬇️', label: 'Téléchargements', path: dirs.downloads },
      { icon: '🖥️', label: 'Bureau', path: dirs.desktop },
      { icon: '🖼️', label: 'Images', path: dirs.pictures },
      { icon: '🎵', label: 'Musique', path: dirs.music },
      { icon: '🎬', label: 'Vidéos', path: dirs.videos }
    ];
    
    elements.shortcuts.innerHTML = '';
    shortcuts.forEach(shortcut => {
      const btn = document.createElement('button');
      btn.className = 'shortcut-btn';
      btn.innerHTML = `<span>${shortcut.icon}</span><span>${shortcut.label}</span>`;
      btn.onclick = () => {
        elements.inputRootPath.value = shortcut.path;
      };
      elements.shortcuts.appendChild(btn);
    });
  }
}

// ================================================
// CHARGEMENT DU DOSSIER
// ================================================

async function loadDirectory(dirPath) {
  console.log('📂 Chargement du dossier:', dirPath);
  
  // Afficher le spinner
  showLoading();
  
  try {
    // Lire le contenu du dossier
    const result = await window.electronAPI.readDirectory(dirPath);
    
    if (!result.success) {
      showError(result.error);
      return;
    }
    
    // Mettre à jour l'état
    appState.currentPath = result.path;
    appState.files = result.items;
    
    // Afficher le contenu
    displayFiles(result.items);
    
    // Mettre à jour l'interface
    updateUI();
    
    // Redémarrer la surveillance sur le nouveau dossier
    if (appState.isWatching) {
      await restartWatching();
    }
    
    updateTimestamp();
    
  } catch (error) {
    console.error('Erreur chargement:', error);
    showError('Impossible de charger le dossier');
  }
}

// ================================================
// AFFICHAGE DES FICHIERS
// ================================================

function displayFiles(items) {
  hideLoading();
  
  if (items.length === 0) {
    elements.emptyState.style.display = 'flex';
    elements.fileList.innerHTML = '';
    elements.fileList.appendChild(elements.emptyState);
    return;
  }
  
  elements.emptyState.style.display = 'none';
  elements.fileList.innerHTML = '';
  
  items.forEach((item, index) => {
    const fileItem = createFileItem(item, index);
    elements.fileList.appendChild(fileItem);
  });
}

function createFileItem(item, index) {
  const div = document.createElement('div');
  div.className = 'file-item';
  div.style.animationDelay = `${index * 0.03}s`;
  
  // Icône
  const icon = getFileIcon(item);
  
  // Taille formatée
  const size = item.isDirectory ? '--' : formatFileSize(item.size);
  
  // Date formatée
  const date = formatDate(item.modified);
  
  div.innerHTML = `
    <div class="file-icon">${icon}</div>
    <div class="file-info">
      <div class="file-name">${escapeHtml(item.name)}</div>
      <div class="file-details">
        <span class="file-size">📊 ${size}</span>
        <span class="file-date">📅 ${date}</span>
      </div>
    </div>
  `;
  
  // Event click
  div.onclick = () => handleFileClick(item);
  
  return div;
}

// ================================================
// GESTION DES CLICS
// ================================================

async function handleFileClick(item) {
  if (item.isDirectory) {
    // Naviguer dans le dossier
    await loadDirectory(item.path);
  } else {
    // Ouvrir le fichier
    showNotification('📂', `Ouverture de ${item.name}...`);
    const result = await window.electronAPI.openFile(item.path);
    if (!result.success) {
      showNotification('❌', `Erreur: ${result.error}`, 'error');
    }
  }
}

// ================================================
// NAVIGATION
// ================================================

async function goToParent() {
  const pathParts = appState.currentPath.split(/[/\\]/).filter(p => p);
  if (pathParts.length > 1) {
    pathParts.pop();
    const parentPath = pathParts.join('/');
    await loadDirectory('/' + parentPath);
  } else {
    showNotification('ℹ️', 'Déjà à la racine');
  }
}

async function goToRoot() {
  if (appState.rootPath) {
    await loadDirectory(appState.rootPath);
  }
}

async function refresh() {
  await loadDirectory(appState.currentPath);
  showNotification('🔄', 'Contenu actualisé');
}

async function openInExternalExplorer() {
  const result = await window.electronAPI.openFolderExternal(appState.currentPath);
  if (result.success) {
    showNotification('✅', 'Dossier ouvert dans l\'explorateur');
  } else {
    showNotification('❌', 'Erreur lors de l\'ouverture', 'error');
  }
}

// ================================================
// SURVEILLANCE TEMPS RÉEL
// ================================================

async function startWatching() {
  if (!appState.currentPath) return;
  
  console.log('👁️ Démarrage surveillance:', appState.currentPath);
  
  const result = await window.electronAPI.startWatching(appState.currentPath);
  if (result.success) {
    appState.isWatching = true;
    
    // Attacher les listeners d'événements
    window.electronAPI.onFileAdded((data) => {
      console.log('✅ Fichier ajouté:', data.name);
      showNotification('➕', `Ajouté: ${data.name}`);
      refresh();
    });
    
    window.electronAPI.onFileRemoved((data) => {
      console.log('❌ Fichier supprimé:', data.name);
      showNotification('➖', `Supprimé: ${data.name}`);
      refresh();
    });
    
    window.electronAPI.onFileChanged((data) => {
      console.log('🔄 Fichier modifié:', data.name);
      showNotification('✏️', `Modifié: ${data.name}`);
      refresh();
    });
  }
}

async function stopWatching() {
  console.log('🛑 Arrêt surveillance');
  await window.electronAPI.stopWatching();
  window.electronAPI.removeFileListeners();
  appState.isWatching = false;
}

async function restartWatching() {
  await stopWatching();
  await startWatching();
}

// ================================================
// MODAL PARAMÈTRES
// ================================================

function openSettings() {
  elements.modalSettings.classList.add('active');
  elements.inputRootPath.value = appState.rootPath;
  elements.checkAutoRefresh.checked = appState.isWatching;
}

function closeSettings() {
  elements.modalSettings.classList.remove('active');
}

async function saveSettings() {
  const newRootPath = elements.inputRootPath.value.trim();
  const autoRefresh = elements.checkAutoRefresh.checked;
  
  if (!newRootPath) {
    showNotification('⚠️', 'Veuillez entrer un chemin valide', 'warning');
    return;
  }
  
  // Vérifier si le chemin existe
  const verifyResult = await window.electronAPI.verifyPath(newRootPath);
  if (!verifyResult.success || !verifyResult.exists) {
    showNotification('❌', 'Ce chemin n\'existe pas', 'error');
    return;
  }
  
  if (!verifyResult.isDirectory) {
    showNotification('❌', 'Ce chemin n\'est pas un dossier', 'error');
    return;
  }
  
  // Sauvegarder la config
  appState.rootPath = newRootPath;
  appState.isWatching = autoRefresh;
  saveConfig();
  
  // Charger le nouveau dossier
  await loadDirectory(newRootPath);
  
  // Gérer la surveillance
  if (autoRefresh) {
    await startWatching();
  } else {
    await stopWatching();
  }
  
  closeSettings();
  showNotification('✅', 'Paramètres sauvegardés');
}

async function browseForDirectory() {
  const result = await window.electronAPI.selectDirectory();
  if (result.success && !result.canceled) {
    elements.inputRootPath.value = result.path;
  }
}

// ================================================
// INTERFACE UTILISATEUR
// ================================================

function updateUI() {
  // Mettre à jour le chemin affiché
  elements.currentPath.textContent = appState.currentPath;
  
  // Mettre à jour le compteur
  const count = appState.files.length;
  elements.itemCount.textContent = count === 0 ? 'Aucun élément' :
    count === 1 ? '1 élément' : `${count} éléments`;
  
  // Activer/désactiver le bouton Parent
  const isRoot = appState.currentPath === appState.rootPath || 
                  appState.currentPath.split(/[/\\]/).filter(p => p).length <= 1;
  elements.btnParent.disabled = isRoot;
}

function showLoading() {
  elements.loadingSpinner.style.display = 'flex';
  elements.emptyState.style.display = 'none';
  elements.errorState.style.display = 'none';
}

function hideLoading() {
  elements.loadingSpinner.style.display = 'none';
}

function showError(message) {
  hideLoading();
  elements.errorState.style.display = 'flex';
  elements.errorMessage.textContent = message;
  elements.fileList.innerHTML = '';
  elements.fileList.appendChild(elements.errorState);
}

function updateTimestamp() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('fr-FR');
  elements.lastUpdateTime.textContent = timeStr;
  appState.lastUpdate = now;
}

// ================================================
// NOTIFICATIONS
// ================================================

function showNotification(icon, text, type = 'info') {
  elements.notificationIcon.textContent = icon;
  elements.notificationText.textContent = text;
  elements.notification.classList.add('show');
  
  // Cacher après 3 secondes
  setTimeout(() => {
    elements.notification.classList.remove('show');
  }, 3000);
}

// ================================================
// EVENT LISTENERS
// ================================================

function attachEventListeners() {
  // Navigation
  elements.btnParent.onclick = goToParent;
  elements.btnHome.onclick = goToRoot;
  elements.btnRefresh.onclick = refresh;
  elements.btnOpenExternal.onclick = openInExternalExplorer;
  
  // Paramètres
  elements.btnSettings.onclick = openSettings;
  elements.btnCloseModal.onclick = closeSettings;
  elements.btnCancel.onclick = closeSettings;
  elements.btnSave.onclick = saveSettings;
  elements.btnBrowse.onclick = browseForDirectory;
  
  // Fermer modal au clic sur overlay
  elements.modalSettings.onclick = (e) => {
    if (e.target === elements.modalSettings) {
      closeSettings();
    }
  };
  
  // Fermer modal avec Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.modalSettings.classList.contains('active')) {
      closeSettings();
    }
  });
}

// ================================================
// UTILITAIRES
// ================================================

function getFileIcon(item) {
  if (item.isDirectory) return '📁';
  
  const iconMap = {
    // Code
    'js': '📜',
    'ts': '📜',
    'jsx': '⚛️',
    'tsx': '⚛️',
    'py': '🐍',
    'java': '☕',
    'cpp': '⚙️',
    'c': '⚙️',
    'cs': '🔷',
    'php': '🐘',
    'rb': '💎',
    'go': '🔵',
    'rs': '🦀',
    
    // Web
    'html': '🌐',
    'css': '🎨',
    'scss': '🎨',
    'sass': '🎨',
    
    // Data
    'json': '📋',
    'xml': '📋',
    'yaml': '📋',
    'yml': '📋',
    'csv': '📊',
    'sql': '🗄️',
    
    // Documents
    'pdf': '📕',
    'doc': '📃',
    'docx': '📃',
    'txt': '📄',
    'md': '📝',
    'rtf': '📄',
    
    // Tableurs & Présentations
    'xls': '📊',
    'xlsx': '📊',
    'ppt': '📊',
    'pptx': '📊',
    
    // Images
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️',
    'svg': '🎨',
    'bmp': '🖼️',
    'ico': '🖼️',
    'webp': '🖼️',
    
    // Vidéos
    'mp4': '🎬',
    'avi': '🎬',
    'mov': '🎬',
    'mkv': '🎬',
    'webm': '🎬',
    'flv': '🎬',
    
    // Audio
    'mp3': '🎵',
    'wav': '🎵',
    'flac': '🎵',
    'ogg': '🎵',
    'aac': '🎵',
    'm4a': '🎵',
    
    // Archives
    'zip': '📦',
    'rar': '📦',
    '7z': '📦',
    'tar': '📦',
    'gz': '📦',
    
    // Exécutables
    'exe': '⚡',
    'app': '⚡',
    'dmg': '💿',
    'iso': '💿',
    
    // Config
    'env': '🔧',
    'config': '🔧',
    'conf': '🔧',
    'ini': '🔧',
    
    // Git
    'git': '🔀',
    'gitignore': '🔀'
  };
  
  return iconMap[item.extension] || '📄';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ================================================
// DÉMARRAGE
// ================================================

// Lancer l'application quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

