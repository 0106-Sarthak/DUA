const { doLogin } = require("./login");
const { runActions } = require("./actions");
const logger = require("../logger");

async function runWorkflow(sheetId, sheet, configuration, page) {

  try {
    if (!page) throw new Error("Page not provided to workflow");

    if (!sheet?.actions || !Array.isArray(sheet.actions)) {
      logger.error("sheet.actions is missing or not an array");
      return false;
    }
    // Iterate over all actions and execute via switch
    for (const action of sheet.actions) {
      switch (action.type) {
        case "launch":
          await runActions(sheetId, page, [action]);
          break;

        case "login":
          const loginFailed = await doLogin(sheetId, page, action);
          if (loginFailed) {
            logger.error("Login failed, stopping workflow");
            return false;
          }
          break;

        default:
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
