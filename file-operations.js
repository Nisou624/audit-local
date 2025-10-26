const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class FileOperations {
  constructor(configManager) {
    this.configManager = configManager;
  }

  async requiresAdminAuth() {
    const config = await this.configManager.loadConfig();
    return config.security.requireAdminForModifications;
  }

  async createFile(filePath, content = '', isAuthenticated = false) {
    try {
      if (await this.requiresAdminAuth() && !isAuthenticated) {
        return { success: false, error: 'Admin authentication required' };
      }

      await fs.writeFile(filePath, content);
      return { success: true, message: 'File created successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createDirectory(dirPath, isAuthenticated = false) {
    try {
      if (await this.requiresAdminAuth() && !isAuthenticated) {
        return { success: false, error: 'Admin authentication required' };
      }

      await fs.mkdir(dirPath, { recursive: true });
      return { success: true, message: 'Directory created successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteItem(itemPath, isAuthenticated = false) {
    try {
      if (await this.requiresAdminAuth() && !isAuthenticated) {
        return { success: false, error: 'Admin authentication required' };
      }

      const stats = await fs.stat(itemPath);
      if (stats.isDirectory()) {
        await fs.rmdir(itemPath, { recursive: true });
      } else {
        await fs.unlink(itemPath);
      }
      
      return { success: true, message: 'Item deleted successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async renameItem(oldPath, newPath, isAuthenticated = false) {
    try {
      if (await this.requiresAdminAuth() && !isAuthenticated) {
        return { success: false, error: 'Admin authentication required' };
      }

      await fs.rename(oldPath, newPath);
      return { success: true, message: 'Item renamed successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = FileOperations;

