const { ipcMain, dialog, app } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFile } = require("child_process");

ipcMain.handle("run-install", async (event, userId, dealerName) => {
  return new Promise((resolve, reject) => {
    try {
      // Use the asar-unpacked folder directly
      const packagedAppDir = path.join(
        process.resourcesPath,
        "app.asar.unpacked",
        "packaged-app",
        "MyApp-win32-x64"
      );

      if (!fs.existsSync(packagedAppDir)) {
        return reject(
          `Packaged app not found at: ${packagedAppDir}. Make sure it exists outside ASAR.`
        );
      }

      // Copy to temp folder
      const tempAppDir = path.join(os.tmpdir(), `MyApp-${Date.now()}`);
      fs.cpSync(packagedAppDir, tempAppDir, { recursive: true });
      console.log("Packaged app copied to temp:", tempAppDir);

      // Run your PowerShell install script
      const tempScriptPath = path.join(os.tmpdir(), "install.ps1");
      fs.copyFileSync(
        path.join(
          process.resourcesPath,
          "app.asar.unpacked",
          "scripts",
          "install.ps1"
        ),
        tempScriptPath
      );

      execFile(
        "powershell.exe",
        [
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          tempScriptPath,
          "-AppPath",
          tempAppDir,
        ],
        { windowsHide: true },
        (err, stdout, stderr) => {
          if (err) return reject(stderr || err.message);
          try {
            // After folder creation, write minimal config.json
            const duaDataPath = path.join(
              process.env.DUA_DATA_PATH || "C:\\dua-data"
            );
            const configDir = path.join(duaDataPath, "config");
            const configFilePath = path.join(configDir, "config.json");

            if (!fs.existsSync(configDir))
              fs.mkdirSync(configDir, { recursive: true });

            const baseConfig = {
              user_id: userId,
              verified: true,
              dealer_name: dealerName,
              action_sheets: [],
            };
            fs.writeFileSync(
              configFilePath,
              JSON.stringify(baseConfig, null, 2)
            );

            console.log("Config.json created at:", configFilePath);
            resolve(stdout || "OK");
          } catch (writeErr) {
            console.error("Failed to write config.json", writeErr);
            reject(writeErr.message);
          }
          resolve(stdout || "OK");
        }
      );
    } catch (err) {
      reject(err.message);
    }
  });
});

ipcMain.handle("run-uninstall", async () => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "scripts", "uninstall.ps1");
    execFile(
      "powershell.exe",
      ["-ExecutionPolicy", "Bypass", "-File", scriptPath],
      (err, stdout, stderr) => {
        if (err) {
          console.error("run-uninstall error", stderr || err);
          return reject(stderr || err.message);
        }
        resolve(stdout || "OK");
      }
    );
  });
});

ipcMain.handle("show-dialog", async (_, options) => {
  return dialog.showMessageBox(options);
});

ipcMain.handle("quit-app", () => {
  app.quit();
});
