const { contextBridge, ipcRenderer } = require("electron");

console.log("preload.js loaded");

contextBridge.exposeInMainWorld("electronAPI", {
  checkUserInputs: () => ipcRenderer.invoke("check-user-inputs"),
  saveUserInputs: (inputs) => ipcRenderer.invoke("save-user-inputs", inputs),
  runInstall: (userId, installationId) =>
    ipcRenderer.invoke("run-install", userId, installationId),
  runUninstall: () => ipcRenderer.invoke("run-uninstall"),
  showDialog: (options) => ipcRenderer.invoke("show-dialog", options),
  quitApp: () => ipcRenderer.invoke("quit-app"),
});
