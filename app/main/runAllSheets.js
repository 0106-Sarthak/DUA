const automation = require("./automation");
const configManager = require("./config-manager");
const logger = require("./logger");

async function runAllSheets(config, userInputs) {
  for (const sheet of config.action_sheets || []) {
    const sheetId = sheet.id;
    const credsArray = userInputs[sheetId]?.inputs || [];

    for (const creds of credsArray) {
      // multi-position
      if (creds.activePositions?.length) {
        for (const pos of creds.activePositions) {
          const runInputs = { ...creds, activePosition: pos };

          configManager.setCurrentRunInputs(sheetId, runInputs);

          logger.info(`Running sheet: ${sheet.name}, user ${creds.userId}, position ${pos}`);

          await automation.start({
            ...sheet.config,
            inputs: runInputs
          });
        }
      } else {
        // single run
        configManager.setCurrentRunInputs(sheetId, creds);

        await automation.start({
          ...sheet.config,
          inputs: creds
        });
      }
    }
  }
}

module.exports = runAllSheets;
