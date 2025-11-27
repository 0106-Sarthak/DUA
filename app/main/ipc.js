const { ipcMain } = require("electron");
const configManager = require("./config-manager");
const automation = require("./automation");
const logger = require("./logger");
const runAllSheets = require("./runAllSheets");

const setupIPC = () => {
  logger.info("Setting up IPC handlers...");

  ipcMain.handle("get-config", () => {
    logger.info("IPC: get-config called");
    const config = configManager.getConfig();
    logger.info("Config returned:", config);
    return config;
  });

  ipcMain.handle("save-config", (_, newConfig) => {
    logger.info("IPC: save-config called with:", newConfig);
    const result = configManager.saveConfig(newConfig);
    logger.info("Config save result:", result);

    // Start automation after first-time config save
    logger.info("Starting automation after config save...");
    // automation.start();
    return result;
  });

  ipcMain.handle("get-user-inputs", () => {
    logger.info("IPC: get-user-inputs called");
    const inputs = configManager.getUserInputs();
    logger.info("User inputs returned:", inputs);
    logger.info("User inputs returned2:", JSON.stringify(inputs, null, 2));
    return inputs;
  });

  ipcMain.handle("save-user-inputs", async (_, newInputs) => {
    logger.info("IPC: save-user-inputs called with:", newInputs);
    const result = configManager.saveUserInputs(newInputs);
    logger.info("User inputs save result:", result);

    const config = configManager.getConfig();

    // Always start automation when user saves credentials
    logger.info("Starting automation after user inputs saved...");
    // automation.start(config);

    await runAllSheets(config, configManager.getUserInputs());

    return result;
  });

  ipcMain.handle("run-automation", async (_, sheetId, input) => {
    try {
      const config = configManager.getConfig();
      await runAllSheets(config, configManager.getUserInputs());
      return result;
    } catch (err) {
      logger.error("Automation failed:", err);
      throw err;
    }
  });

  logger.info("IPC handlers setup complete.");
};

module.exports = setupIPC;
