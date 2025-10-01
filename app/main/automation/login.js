const configManager = require("../config-manager");

async function doLogin(sheetId, page, loginAction, loginBlocked = false) {
    let loginFailed = false;

    console.log("DEBUG: Starting login action...");
    console.log("DEBUG: Fields to fill:", loginAction.fields);
    console.log("DEBUG: Submit action:", loginAction.submit);

    if (!loginAction.fields || loginAction.fields.length === 0) {
        console.log("DEBUG: No fields defined for login.");
    }

    // Fill fields
    for (const field of loginAction.fields || []) {
        let value = field.useUserInput
            ? configManager.getUserInput(sheetId, field.inputToken)
            : field.value;
        console.log(`DEBUG: Filling field ${field.selector} with value:`, value);
        try {
            await page.type(field.selector, value);
        } catch (err) {
            console.log(
                `DEBUG: Error typing into selector ${field.selector}:`,
                err.message
            );
            loginFailed = true;
        }
    }

    // Submit
    if (loginAction.submit?.selector) {
        console.log("DEBUG: Submit selector found:", loginAction.submit.selector);
        try {
            await page.waitForSelector(loginAction.submit.selector, {
                timeout: 60000,
            });
            console.log("DEBUG: Submit selector is visible, clicking now...");
            await page.click(loginAction.submit.selector);
            console.log("DEBUG: Clicked submit button.");
        } catch (err) {
            console.log(
                "DEBUG: Submit selector not found or not clickable:",
                err.message
            );
        }
    } else {
        console.log("DEBUG: Submit action not defined or missing selector.");
    }

    console.log("DEBUG: Login action completed, waiting for navigation...");
    if (loginAction.waitAfterSubmit) {
        console.log(
            `DEBUG: Waiting after submit for ${loginAction.waitAfterSubmit}ms...`
        );
        await page.waitForSelector("body", {
            visible: true,
            timeout: Math.max(loginAction.waitAfterSubmit, 1000),
        });
    }

    console.log("DEBUG: Checking for login failure indicators...");
    try {
        const handle = await page.waitForFunction(
            () => {
                const errEl = document.querySelector("#statusBar.siebui-error");
                if (errEl) {
                    const text = errEl.innerText || "";
                    if (text.includes("incorrect") || text.includes("SBL-UIF-00272")) {
                        return true;
                    }
                }
                const successEl = document.querySelector("#some-dashboard-element");
                if (successEl) return false;
                return undefined;
            },
            { timeout: 7000 }
        );

        loginFailed = await handle.jsonValue();
        console.log("DEBUG: loginFailed result from waitForFunction:", loginFailed);
    } catch (err) {
        loginFailed = false; // assume success if no error appeared
        console.log("DEBUG: No error indicator found, assuming login success.");
    }

    if (loginBlocked) {
        loginFailed = true;
        console.log("DEBUG: loginBlocked is true, setting loginFailed to true.");
    }

    console.log("DEBUG: Login failed status:", loginFailed);
    return loginFailed;
}

module.exports = { doLogin };
