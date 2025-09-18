const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    getUserInputs: () => ipcRenderer.invoke('get-user-inputs'),
    saveUserInputs: (inputs) => ipcRenderer.invoke('save-user-inputs', inputs),
});
