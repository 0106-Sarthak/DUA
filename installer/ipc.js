const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

ipcMain.handle('run-install', async () => {
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
        resolve(stdout || 'OK');
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
