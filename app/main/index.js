const { app, BrowserWindow } = require("electron");
// const path = require("path");
const setupIPC = require("./ipc");
const automation = require("./automation");
const configManager = require("./config-manager");
const logger = require("./logger");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { generateUserJson } = require("./generate-user"); 

function streamLogFile() {
  const logDir = path.join("C:\\DuaReports", "logs");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const logFile = path.join(logDir, `${new Date().toISOString().slice(0, 10)}.log`);

  // Ensure file exists
  if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, "");

  // Build command to open a new terminal window and tail the log
  // Using PowerShell in a new CMD window
  const cmd = `start powershell -NoExit -Command "Get-Content -Path '${logFile}' -Wait"`;

  exec(cmd, (error) => {
    if (error) console.error("Failed to open log window:", error);
  });
}
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
  streamLogFile(); 
  generateUserJson(); 
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
