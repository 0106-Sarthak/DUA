const { ipcMain } = require('electron');
const configManager = require('./config-manager');
const automation = require('./automation');

const setupIPC = () => {

  ipcMain.handle('get-config', () => {
    return configManager.getConfig();
  });

  ipcMain.handle('save-config', (_, newConfig) => {
    const result = configManager.saveConfig(newConfig);

    // Start automation after first-time config save
    automation.start();

    return result;
  });

  ipcMain.handle('get-user-inputs', () => {
    return configManager.getUserInputs();
  });

  ipcMain.handle('save-user-inputs', (_, newInputs) => {
    return configManager.saveUserInputs(newInputs);
  });

};

module.exports = setupIPC;
