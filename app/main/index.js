const { app, BrowserWindow } = require("electron");
const path = require("path");
const setupIPC = require("./ipc");
const automation = require("./automation");
const configManager = require("./config-manager");
const logger = require("./logger");

// const configFilePath = "C:\\dua-data\\config\\config.json";

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(async () => {
  createWindow();

  setupIPC();
  // automation.start(config);
  const config = configManager.getConfig();
  const userInputs = configManager.getUserInputs();

  async function runAllSheets() {
    for (const sheet of config.action_sheets) {
      const sheetId = sheet.id;
      const credsArray = userInputs[sheetId]?.inputs || [];

      for (const creds of credsArray) {
        logger.info(`🚀 Running sheet "${sheetId}" for user "${creds.userId}"`);

        // Set current run creds so automation can pick them
        configManager.setCurrentRunInputs(sheetId, creds);

        try {
          await automation.start({
            ...sheet.config,
            inputs: creds, // pass single creds object
          });
          logger.info(`✅ Completed for ${creds.userId}`);
        } catch (err) {
          logger.error(`❌ Failed for ${creds.userId}:`, err);
        }
      }
    }
  }

  runAllSheets();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
