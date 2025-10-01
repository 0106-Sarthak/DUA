// automation/login.js
const configManager = require("../config-manager");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function doLogin(sheetId, page, loginAction) {
  let loginFailed = false;
  let dialogMessage = null;

  console.log("DEBUG: Starting login action...");
  if (!loginAction) {
    console.log("DEBUG: No loginAction provided.");
    return true; // treat as failure
  }

  // capture dialog that may appear right after submit
  const dialogHandler = async (dialog) => {
    try {
      dialogMessage = dialog.message();
      console.log("DEBUG: Dialog appeared (captured):", dialogMessage);
      await dialog.dismiss().catch((err) => {
        console.log("DEBUG: dialog.dismiss() error (ignored):", err && err.message);
      });
    } catch (err) {
      console.log("DEBUG: dialogHandler error:", err && err.message);
    }
  };

  page.once("dialog", dialogHandler);

  // Fill fields
  for (const field of loginAction.fields || []) {
    const value = field.useUserInput
      ? configManager.getUserInput(sheetId, field.inputToken)
      : field.value;
    console.log(`DEBUG: Typing into ${field.selector} = ${value}`);
    try {
      await page.type(field.selector, value);
    } catch (err) {
      console.log(`DEBUG: Error typing into ${field.selector}:`, err && err.message);
      loginFailed = true;
    }
  }

  // Click submit
  if (loginAction.submit?.selector) {
    try {
      await page.waitForSelector(loginAction.submit.selector, { timeout: 60000 });
      console.log("DEBUG: Clicking submit...");
      await page.click(loginAction.submit.selector);
      console.log("DEBUG: Clicked submit.");
    } catch (err) {
      console.log("DEBUG: Could not click submit:", err && err.message);
      loginFailed = true;
    }
  } else {
    console.log("DEBUG: No submit selector provided.");
  }

  // Stabilize wait
  const stabilizeMs = loginAction.waitAfterSubmit || 5000;
  console.log(`DEBUG: Waiting ${stabilizeMs}ms to stabilize and capture any dialog...`);
  await sleep(stabilizeMs);

  // Check if dialog was captured
  if (dialogMessage) {
    console.log("DEBUG: Dialog captured during stabilization:", dialogMessage);
    if (dialogMessage.includes("Max Concurrent Sessions")) {
      console.log("DEBUG: Max concurrent sessions appeared -> login blocked.");
      loginFailed = true;
    } else {
      console.log("DEBUG: Dialog appeared -> treating as login failed.");
      loginFailed = true;
    }
  } else {
    console.log("DEBUG: No dialog captured during stabilization.");
  }

  // If not failed, check inline error indicators
  if (!loginFailed) {
    console.log("DEBUG: Checking inline error indicators...");
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
      console.log("DEBUG: Inline login check result:", result);
      loginFailed = !!result;
    } catch (err) {
      console.log("DEBUG: No inline error detected (wait timed out). Assuming success.");
      loginFailed = false;
    }
  }

  console.log("DEBUG: Final loginFailed =", loginFailed);
  return loginFailed; // true => failed, false => success
}

module.exports = { doLogin };
