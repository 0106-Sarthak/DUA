const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

ipcMain.handle('run-install', async (event, userId, dealerName) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'scripts', 'install.ps1');

    execFile(
      'powershell.exe',
      ['-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      (err, stdout, stderr) => {
        if (err) {
          console.error('run-install error', stderr || err);
          return reject(stderr || err.message);
        }

        try {
          // After folder creation, write minimal config.json
          const duaDataPath = path.join(process.env.DUA_DATA_PATH || 'C:\\dua-data');
          const configDir = path.join(duaDataPath, 'config');
          const configFilePath = path.join(configDir, 'config.json');

          if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

          const baseConfig = { user_id: userId, verified: true, dealer_name: dealerName, action_sheets: [] };
          fs.writeFileSync(configFilePath, JSON.stringify(baseConfig, null, 2));

          console.log('Config.json created at:', configFilePath);
          resolve(stdout || 'OK');
        } catch (writeErr) {
          console.error('Failed to write config.json', writeErr);
          reject(writeErr.message);
        }
      }
    );
  });
});

ipcMain.handle('run-uninstall', async () => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'scripts', 'uninstall.ps1');
    execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath], (err, stdout, stderr) => {
      if (err) {
        console.error('run-uninstall error', stderr || err);
        return reject(stderr || err.message);
      }
      resolve(stdout || 'OK');
    });
  });
});

ipcMain.handle('show-dialog', async (_, options) => {
  return dialog.showMessageBox(options);
});

ipcMain.handle('quit-app', () => {
  app.quit();
});
