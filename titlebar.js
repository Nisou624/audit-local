class TitleBar {
  constructor() {
    this.init();
  }

  init() {
    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.createTitleBar());
    } else {
      this.createTitleBar();
    }
  }

  createTitleBar() {
    // Check if titlebar already exists
    if (document.querySelector('.custom-titlebar')) {
      return;
    }

    const titleBar = document.createElement('div');
    titleBar.className = 'custom-titlebar glass-card-titlebar';
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
    
    // Insert at the very beginning of body
    document.body.insertBefore(titleBar, document.body.firstChild);
    
    // Bind events after creating the titlebar
    this.bindEvents();
  }

  bindEvents() {
    const minimizeBtn = document.getElementById('minimizeBtn');
    const maximizeBtn = document.getElementById('maximizeBtn');
    const closeBtn = document.getElementById('closeBtn');

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.electronAPI.windowMinimize();
      });
    }

    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.electronAPI.windowToggleMaximize();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.electronAPI.windowClose();
      });
    }
  }
}

// Initialize titlebar immediately
const titleBar = new TitleBar();

