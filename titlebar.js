const { ipcRenderer } = require('electron');

class TitleBar {
  constructor() {
    this.init();
  }

  init() {
    this.createTitleBar();
    this.bindEvents();
  }

  createTitleBar() {
    const titleBar = document.createElement('div');
    titleBar.className = 'custom-titlebar glass-card';
    titleBar.innerHTML = `
      <div class="titlebar-content">
        <div class="titlebar-left">
          <div class="app-icon">📂</div>
          <div class="app-name">File Explorer Glass</div>
        </div>
        <div class="titlebar-right">
          <button class="titlebar-btn" id="minimizeBtn" title="Minimize">
            <span>−</span>
          </button>
          <button class="titlebar-btn" id="maximizeBtn" title="Maximize">
            <span>□</span>
          </button>
          <button class="titlebar-btn close-btn" id="closeBtn" title="Close">
            <span>×</span>
          </button>
        </div>
      </div>
    `;
    
    document.body.insertBefore(titleBar, document.body.firstChild);
  }

  bindEvents() {
    document.getElementById('minimizeBtn').addEventListener('click', () => {
      ipcRenderer.invoke('window-minimize');
    });

    document.getElementById('maximizeBtn').addEventListener('click', () => {
      ipcRenderer.invoke('window-toggle-maximize');
    });

    document.getElementById('closeBtn').addEventListener('click', () => {
      ipcRenderer.invoke('window-close');
    });

    // Make titlebar draggable
    const titlebar = document.querySelector('.custom-titlebar');
    titlebar.addEventListener('mousedown', () => {
      ipcRenderer.invoke('window-drag');
    });
  }
}

// Initialize titlebar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TitleBar();
});


