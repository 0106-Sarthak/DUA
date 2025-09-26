const { app, BrowserWindow } = require("electron");
const path = require("path");
const setupIPC = require("./ipc");
const fs = require("fs");
const automation = require("./automation");
const sheetSync = require("./sheet-sync");
const configManager = require("./config-manager");
const api = require("../services/api");

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

async function fetchAndAppendSheets(userId) {
  try {
    // Example: fetch list of sheets for this user
    console.log("Fetching action sheets for user:", userId);
    const sheets = await api.fetchRemoteSheets(userId);

    sheets.forEach((sheet) => {
      // sheet should be in the format:
      // { id: "sheet-1", name: "sheet-1", config: { runtimes: { ... } } }
      configManager.appendActionSheet(sheet);
    });

    console.log("All fetched sheets appended to config.");
  } catch (err) {
    console.error("Failed to fetch/append action sheets:", err);
  }
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
        console.log(`🚀 Running sheet "${sheetId}" for user "${creds.userId}"`);

        // Set current run creds so automation can pick them
        configManager.setCurrentRunInputs(sheetId, creds);

        try {
          await automation.start({
            ...sheet.config,
            inputs: creds, // pass single creds object
          });
          console.log(`✅ Completed for ${creds.userId}`);
        } catch (err) {
          console.error(`❌ Failed for ${creds.userId}:`, err);
        }
      }
    }
  }

  runAllSheets();

  // code to fetch and append sheets, then start automation if user inputs exist
  // if (config && config.user_id && config.verified) {
  //   // Append sheets dynamically
  //   console.log("User verified. Fetching and appending action sheets...");
  //   await fetchAndAppendSheets(config.user_id);

  //   const userInputs = configManager.getUserInputs();

  //   if (userInputs && Object.keys(userInputs).length > 0) {
  //     console.log("User inputs found. Starting automation...");
  //     automation.start(configManager.getConfig());
  //   } else {
  //     console.log("User inputs missing. Automation will not start yet.");
  //   }
  // }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
