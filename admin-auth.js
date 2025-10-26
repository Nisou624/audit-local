class AdminAuth {
  constructor() {
    this.isAdmin = false;
    this.init();
  }

  async init() {
    await this.checkAdminStatus();
    this.createAdminUI();
  }

  async checkAdminStatus() {
    try {
      const result = await window.electronAPI.checkAdminPrivileges();
      this.isAdmin = result.isAdmin;
      this.updateAdminIndicator();
    } catch (error) {
      console.error('Failed to check admin status:', error);
    }
  }

  createAdminUI() {
    // Add admin indicator to header
    const header = document.querySelector('.header-content');
    if (header && !document.querySelector('.admin-indicator')) {
      const adminIndicator = document.createElement('div');
      adminIndicator.className = 'admin-indicator';
      adminIndicator.innerHTML = `
        <span class="admin-icon">🔒</span>
        <span class="admin-text">Standard User</span>
      `;
      header.appendChild(adminIndicator);
    }
  }

  updateAdminIndicator() {
    const indicator = document.querySelector('.admin-indicator');
    if (indicator) {
      const icon = indicator.querySelector('.admin-icon');
      const text = indicator.querySelector('.admin-text');
      
      if (this.isAdmin) {
        icon.textContent = '🔓';
        text.textContent = 'Administrator';
        indicator.style.color = '#34d399';
      } else {
        icon.textContent = '🔒';
        text.textContent = 'Standard User';
        indicator.style.color = '#fbbf24';
      }
    }
  }

  async requestElevation(operation, ...args) {
    try {
      this.showNotification('Requesting administrator privileges...', 'info');
      const result = await window.electronAPI.requestAdminPrivileges(operation, ...args);
      
      if (result.success) {
        this.showNotification('Operation completed with admin rights', 'success');
        await this.checkAdminStatus(); // Refresh admin status
      } else {
        this.showNotification('Admin operation failed: ' + result.error, 'error');
      }
      
      return result;
    } catch (error) {
      this.showNotification('Failed to request admin privileges: ' + error.message, 'error');
      return { success: false, error: error.message };
    }
  }

  showNotification(message, type) {
    // Use the existing notification system from the main app
    if (window.app && window.app.showNotification) {
      window.app.showNotification(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }
}

// Initialize admin auth
document.addEventListener('DOMContentLoaded', () => {
  window.adminAuth = new AdminAuth();
});

