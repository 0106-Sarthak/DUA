const { ipcMain } = require("electron");
const configManager = require("./config-manager");
const automation = require("./automation");

const setupIPC = () => {
  console.log("Setting up IPC handlers...");

  ipcMain.handle("get-config", () => {
    console.log("IPC: get-config called");
    const config = configManager.getConfig();
    console.log("Config returned:", config);
    return config;
  });

  ipcMain.handle("save-config", (_, newConfig) => {
    console.log("IPC: save-config called with:", newConfig);
    const result = configManager.saveConfig(newConfig);
    console.log("Config save result:", result);

    // Start automation after first-time config save
    console.log("Starting automation after config save...");
    automation.start();
    return result;
  });

  ipcMain.handle("get-user-inputs", () => {
    console.log("IPC: get-user-inputs called");
    const inputs = configManager.getUserInputs();
    console.log("User inputs returned:", inputs);
    console.log("User inputs returned2:", JSON.stringify(inputs, null, 2));
    return inputs;
  });

  ipcMain.handle("save-user-inputs", (_, newInputs) => {
    console.log("IPC: save-user-inputs called with:", newInputs);
    const result = configManager.saveUserInputs(newInputs);
    console.log("User inputs save result:", result);

    const config = configManager.getConfig();
    if (
      config &&
      config.user_id &&
      config.verified &&
      Object.keys(newInputs).length > 0
    ) {
      console.log("Starting automation after user inputs set...");
      automation.start(config);
    }

    return result;
  });

  console.log("IPC handlers setup complete.");
};

module.exports = setupIPC;
