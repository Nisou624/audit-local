const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class ConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.audit-local');
    this.configFile = path.join(this.configDir, 'config.json');
    this.defaultConfig = {
      explorer: {
        defaultPath: './sample-folder',
        autoRefresh: true
      },
      app: {
        showConfigButton: true
      },
      security: {
        requireAdminForModifications: true,
        adminPassword: 'admin123'
      },
      ui: {
        backgroundImage: null
      }
    };
  }

  async loadConfig() {
    try {
      await this.ensureConfigDir();
      
      const configExists = await this.fileExists(this.configFile);
      if (!configExists) {
        await this.saveConfig(this.defaultConfig);
        return this.defaultConfig;
      }

      const configData = await fs.readFile(this.configFile, 'utf8');
      const config = JSON.parse(configData);
      
      // Merge with defaults to ensure all keys exist
      return this.mergeConfigs(this.defaultConfig, config);
    } catch (error) {
      console.error('Failed to load config:', error);
      return this.defaultConfig;
    }
  }

  async saveConfig(config) {
    try {
      await this.ensureConfigDir();
      const configJson = JSON.stringify(config, null, 2);
      await fs.writeFile(this.configFile, configJson);
      return { success: true };
    } catch (error) {
      console.error('Failed to save config:', error);
      return { success: false, error: error.message };
    }
  }

  async ensureConfigDir() {
    try {
      await fs.access(this.configDir);
    } catch {
      await fs.mkdir(this.configDir, { recursive: true });
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  mergeConfigs(defaultConfig, userConfig) {
    const merged = { ...defaultConfig };
    
    for (const key in userConfig) {
      if (typeof userConfig[key] === 'object' && userConfig[key] !== null) {
        merged[key] = { ...defaultConfig[key], ...userConfig[key] };
      } else {
        merged[key] = userConfig[key];
      }
    }
    
    return merged;
  }
}

module.exports = ConfigManager;

