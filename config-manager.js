const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.configPath = path.join(__dirname, 'config.json');
    this.defaultConfig = {
      app: {
        name: "File Explorer Glass",
        version: "1.0.0",
        showConfigButton: true,
        configShortcut: "Ctrl+Comma"
      },
      explorer: {
        defaultPath: "./sample-folder",
        pathType: "local",
        autoRefresh: true,
        refreshInterval: 1000
      },
      ui: {
        backgroundImage: "./assets/background.jpg",
        theme: "glass",
        showTitleBar: false
      },
      security: {
        requireAdminForModifications: false,
        adminPassword: "admin123"
      }
    };
  }

  async loadConfig() {
    try {
      if (!fsSync.existsSync(this.configPath)) {
        await this.createDefaultConfig();
      }
      
      const configData = await fs.readFile(this.configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('Error loading config:', error);
      return this.defaultConfig;
    }
  }

  async saveConfig(config) {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Error saving config:', error);
      return { success: false, error: error.message };
    }
  }

  async createDefaultConfig() {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(this.defaultConfig, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Error creating default config:', error);
      return { success: false, error: error.message };
    }
  }

  async resetConfig() {
    return await this.createDefaultConfig();
  }
}

module.exports = ConfigManager;

