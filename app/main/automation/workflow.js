
const { doLogin } = require("./login");
const { runActions } = require("./actions");

async function runWorkflow(sheetId, sheet, configuration, page) {
    console.log("=== Starting workflow for sheetId:", sheetId, "===");

    try {
        if (!page) throw new Error("Page not provided to workflow");

        if (!sheet?.actions || !Array.isArray(sheet.actions)) {
            console.error("sheet.actions is missing or not an array");
            return false;
        }

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

    }
}

module.exports = { runWorkflow };
