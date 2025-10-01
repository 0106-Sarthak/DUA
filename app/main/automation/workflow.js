const { launchBrowser } = require("./browser");
const { doLogin } = require("./login");
const { runActions } = require("./actions"); // runAction for individual actions

async function runWorkflow(sheetId, sheet, configuration) {
    console.log("=== Starting workflow for sheetId:", sheetId, "===");

    let browser, page;

    try {
        if (!sheet?.actions || !Array.isArray(sheet.actions)) {
            console.error("sheet.actions is missing or not an array");
            return false;
        }

        console.log("Launching browser...");
        const launchResult = await launchBrowser();
        browser = launchResult?.browser;
        page = launchResult?.page;

        if (!browser || !page) {
            throw new Error("Browser or page not created");
        }

        console.log("Browser launched successfully");

        // Iterate over all actions and execute via switch
        for (const action of sheet.actions) {
            console.log("Executing action:", action.type);

            switch (action.type) {
                case "launch":
                    console.log("Launching site:", action.site);
                    await runActions(sheetId, page, [action]);
                    break;

                case "login":
                    console.log("Executing login");
                    const loginFailed = await doLogin(sheetId, page, action);
                    if (loginFailed) {
                        console.error("Login failed, stopping workflow");
                        return false;
                    }
                    break;

                default:
                    console.log("Executing other action:", action.type);
                    await runActions(sheetId, page, [action]);
            }
        }

        console.log("Workflow completed successfully");
        return true;

    } catch (err) {
        console.error("Workflow error caught:", err);
        return false;

    } finally {
        if (browser) {
            try {
                await browser.close();
                console.log("Browser closed");
            } catch (closeErr) {
                console.error("Error closing browser:", closeErr);
            }
        }
    }
}

module.exports = { runWorkflow };
