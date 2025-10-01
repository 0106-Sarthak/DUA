const { logger } = require("../logger");
const configManager = require("../config-manager");

async function doLogin(sheetId, page, loginAction) {
  let loginFailed = false;

  for (const field of loginAction.fields || []) {
    let value = field.useUserInput
      ? configManager.getUserInput(sheetId, field.inputToken)
      : field.value;
    await page.type(field.selector, value);
  }

  if (loginAction.submit?.selector) {
    await page.waitForSelector(loginAction.submit.selector, { timeout: 60000 });
    await page.click(loginAction.submit.selector);
  }

  // detect login error
  try {
    loginFailed = await page.waitForFunction(() => {
      const el = document.querySelector("#statusBar.siebui-error");
      return el ? true : false;
    }, { timeout: 7000 });
  } catch {
    loginFailed = false;
  }

  return loginFailed;
}

module.exports = { doLogin };
