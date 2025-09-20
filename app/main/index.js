const { app, BrowserWindow } = require("electron");
const path = require("path");
const setupIPC = require("./ipc");
const fs = require("fs");
const automation = require("./automation");
const sheetSync = require("./sheet-sync");
const configManager = require("./config-manager");
const api = require("../services/api");

const configFilePath = "C:\\dua-data\\config\\config.json";

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

  const config = configManager.getConfig();
  if (config && config.user_id && config.verified) {
    // Append sheets dynamically
    console.log("User verified. Fetching and appending action sheets...");
    await fetchAndAppendSheets(config.user_id);

    const userInputs = configManager.getUserInputs();

    if (userInputs && Object.keys(userInputs).length > 0) {
      console.log("User inputs found. Starting automation...");
      automation.start(configManager.getConfig());
    } else {
      console.log("User inputs missing. Automation will not start yet.");
    }
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
