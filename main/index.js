const { app, BrowserWindow } = require("electron");
const path = require("path");
const setupIPC = require("./ipc");
const fs = require("fs");
const automation = require("./automation");

const configFilePath = path.join(__dirname, "../config/config.json");

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

app.whenReady().then(() => {
  createWindow();

  setupIPC();

  const configManager = require("./config-manager");
  const config = configManager.getConfig();
  if (config && config.user_id) {
    automation.start(config); // pass config to automation
  }

  // Start automation if config exists
  //   if (fs.existsSync(configFilePath)) {
  //     automation.start();
  //   }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
