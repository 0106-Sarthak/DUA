const { app, BrowserWindow } = require("electron");
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

  const logFile = path.join(
    logDir,
    `${new Date().toISOString().slice(0, 10)}.log`
  );

  // Ensure file exists
  if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, "");

  const cmd = `start powershell -NoExit -Command "Get-Content -Path '${logFile}' -Wait"`;
  exec(cmd, (error) => {
    if (error) console.error("Failed to open log window:", error);
  });
}

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
    for (const sheet of config.action_sheets || []) {
      const sheetId = sheet.id;
      const credsArray = userInputs[sheetId]?.inputs || [];

      for (const creds of credsArray) {
        logger.info(`Running sheet "${sheetId}" for user "${creds.userId}"`);

        // If multiple activePositions exist
        if (Array.isArray(creds.activePositions) && creds.activePositions.length > 0) {
          for (const pos of creds.activePositions) {
            const runInputs = { ...creds, activePosition: pos };

            // Set current run inputs for this iteration
            configManager.setCurrentRunInputs(sheetId, runInputs);

            logger.info(`Running for position: ${pos}`);

            // Pass the exact current runInputs to runActions
            console.log(`[DEBUG] Current run inputs for sheet ${sheetId}:`, runInputs);
            try {
              await automation.start({
                ...sheet.config,
                inputs: runInputs,  // make sure automation uses this
              });
            }
            catch (err) {
              logger.error(`Failed for ${creds.userId} - ${pos}:`, err);
            }
          }
        } else {
          // Normal sheet without multiple positions
          configManager.setCurrentRunInputs(sheetId, creds);

          console.log(`[DEBUG] Current run inputs for sheet ${sheetId}:`, creds);

          try {
            await automation.start({
              ...sheet.config,
              inputs: creds,
            });
            logger.info(`Completed for ${creds.userId}`);
          } catch (err) {
            logger.error(`Failed for ${creds.userId}:`, err);
          }
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
