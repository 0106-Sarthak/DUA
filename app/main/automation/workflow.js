const { doLogin } = require("./login");
const { runActions } = require("./actions");
const logger = require("../logger");

async function runWorkflow(sheetId, sheet, configuration, page) {
  logger.debug("=== Starting workflow for sheetId:", sheetId, "===");

  try {
    if (!page) throw new Error("Page not provided to workflow");

    if (!sheet?.actions || !Array.isArray(sheet.actions)) {
      logger.error("sheet.actions is missing or not an array");
      return false;
    }

    // Iterate over all actions and execute via switch
    for (const action of sheet.actions) {
      logger.debug("Executing action:", action.type);

      switch (action.type) {
        case "launch":
          logger.debug("Launching site:", action.site);
          await runActions(sheetId, page, [action]);
          break;

        case "login":
          logger.debug("Executing login");
          const loginFailed = await doLogin(sheetId, page, action);
          if (loginFailed) {
            logger.error("Login failed, stopping workflow");
            return false;
          }
          break;

        default:
          logger.debug("Executing other action:", action.type);
          await runActions(sheetId, page, [action]);
      }
    }

    logger.debug("Workflow completed successfully");
    return true;
  } catch (err) {
    logger.error("Workflow error caught:", err);
    return false;
  }
}

module.exports = { runWorkflow };
