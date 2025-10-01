const { launchBrowser } = require("./browser");
const { doLogin } = require("./login");
const { runActions } = require("./actions");
const { logger } = require("../logger");

async function runWorkflow(sheetId, sheet, configuration) {
  const { browser, page } = await launchBrowser();
  try {
    const loginAction = sheet.actions.find(a => a.type === "login");
    if (loginAction) {
      const loginFailed = await doLogin(sheetId, page, loginAction);
      if (loginFailed) {
        logger.error("Login failed, stopping workflow");
        return false;
      }
    }

    const nonLoginActions = sheet.actions.filter(a => a.type !== "login");
    await runActions(sheetId, page, nonLoginActions);

    return true;
  } catch (err) {
    logger.error("Workflow error:", err.message);
    return false;
  } finally {
    await browser.close();
    logger.info("Browser closed");
  }
}

module.exports = { runWorkflow };
