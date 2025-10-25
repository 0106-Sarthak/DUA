const configManager = require("../config-manager");
const logger = require("../logger");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function doLogin(sheetId, page, loginAction) {
  let loginFailed = false;
  let dialogMessage = null;
  logger.debug("Starting login action...");
  if (!loginAction) {
    return true; // treat as failure
  }

  // capture dialog that may appear right after submit
  const dialogHandler = async (dialog) => {
    try {
      dialogMessage = dialog.message();
      logger.debug("Dialog appeared (captured):", dialogMessage);
      await dialog.dismiss().catch((err) => {
        logger.debug("Dialog dismiss error (ignored):", err && err.message);
      });
    } catch (err) {
      logger.debug("Dialog handler error:", err && err.message);
    }
  };

  page.once("dialog", dialogHandler);

  // Fill fields
  for (const field of loginAction.fields || []) {
    const value = field.useUserInput
      ? configManager.getUserInput(sheetId, field.inputToken)
      : field.value;
    try {
      await page.type(field.selector, value);
    } catch (err) {
      loginFailed = true;
    }
  }

  // Click submit
  if (loginAction.submit?.selector) {
    try {
      await page.waitForSelector(loginAction.submit.selector, {
        timeout: 60000,
      });
      await page.click(loginAction.submit.selector);
      logger.debug("Clicked submit.");
    } catch (err) {
      logger.debug("Could not click submit:", err && err.message);
      loginFailed = true;
    }
  } else {
    logger.debug("No submit selector provided.");
  }

  // Stabilize wait
  const stabilizeMs = loginAction.waitAfterSubmit || 20000;
  logger.debug(`Waiting ${stabilizeMs}ms to stabilize and capture any dialog...`);
  await sleep(stabilizeMs);

  // Check if dialog was captured
  if (dialogMessage) {
    logger.debug("Dialog captured during stabilization:", dialogMessage);
    if (dialogMessage.includes("Max Concurrent Sessions")) {
      loginFailed = true;
    } else {
      logger.debug("Dialog appeared -> treating as login failed.");
      loginFailed = true;
    }
  } else {
    logger.debug("No dialog captured during stabilization.");
  }

  // If not failed, check inline error indicators
  if (!loginFailed) {
    logger.debug("Checking inline error indicators...");
    try {
      const handle = await page.waitForFunction(
        () => {
          const errEl = document.querySelector("#statusBar.siebui-error");
          if (errEl) {
            const txt = errEl.innerText || "";
            if (/incorrect|SBL-UIF-00272/i.test(txt)) return true;
          }
          const successEl = document.querySelector("#some-dashboard-element");
          if (successEl) return false;
          return undefined;
        },
        { timeout: 7000 }
      );

      const result = await handle.jsonValue();
      loginFailed = !!result;
    } catch (err) {
      logger.debug(
        "No inline error detected (wait timed out). Assuming success."
      );
      loginFailed = false;
    }
  }
  return loginFailed; // true => failed, false => success
}

module.exports = { doLogin };
