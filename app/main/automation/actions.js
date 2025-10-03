const { waitUntilDownload } = require("../download-helper");
const { format } = require("date-fns");
const configManager = require("../config-manager");
const reportDownloadDir = require("../constants").reportDownloadDir;

function sleep(ms) {
    console.log(`[DEBUG] sleep called with ms: ${ms}`);
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDynamicDate(monthsAgo) {
    console.log(`[DEBUG] getDynamicDate called with monthsAgo: ${monthsAgo}`);
    const today = new Date();
    today.setMonth(today.getMonth() - monthsAgo);
    today.setDate(1);
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();
    const result = `>=${day}/${month}/${year}`;
    console.log(`[DEBUG] getDynamicDate result: ${result}`);
    return result;
}

async function runAction(sheetId, page, action) {
    console.log("[DEBUG] runAction called with:", { sheetId, action });
    switch (action.type) {
        case "launch":
            console.log(`[DEBUG] Launch action for site: ${action.site}`);
            try {
                await page.goto(action.site, {
                    waitUntil: "networkidle2",
                    timeout: 60000,
                });
                console.log(`[DEBUG] Navigation complete for site: ${action.site}`);
            } catch (err) {
                console.log(`[DEBUG] Navigation failed: ${err.message}`);
                try {
                    console.log("[DEBUG] Attempting to reload the page...");
                    await page.reload({
                        waitUntil: "networkidle2",
                        timeout: 60000,
                    });
                    console.log("[DEBUG] Reload successful");
                } catch (reloadErr) {
                    console.log(`[DEBUG] Reload failed: ${reloadErr.message}`);
                }
            }
            break;

        case "wait":
            console.log("[DEBUG] Waiting for duration:", action.duration);
            await sleep(action.duration);
            console.log("[DEBUG] Wait completed");
            break;

        case "click":
            console.log("[DEBUG] Click action object:", action);

            if (action.selector.startsWith("//")) {
                action.selector = action.selector.replace(
                    "{{searchText}}",
                    action.searchText
                );
                console.log("[DEBUG] Waiting for XPath:", action.selector);
                try {
                    await page.waitForFunction(
                        (xpath) => {
                            const result = document.evaluate(
                                xpath,
                                document,
                                null,
                                XPathResult.FIRST_ORDERED_NODE_TYPE,
                                null
                            );
                            return result.singleNodeValue || null;
                        },
                        { timeout: 60000 },
                        action.selector
                    );
                    console.log("[DEBUG] XPath element found, executing click logic.");

                    await page.evaluate((searchText) => {
                        console.log("[DEBUG] Searching for links containing:", searchText);
                        const links = Array.from(document.querySelectorAll("a")).filter(
                            (a) => a.textContent.includes(`${searchText}`)
                        );

                        if (links.length === 0) {
                            console.error(
                                `[DEBUG] No links found containing '${searchText}'`
                            );
                            return;
                        }
                        console.log(
                            `[DEBUG] Found ${links.length} link(s) containing '${searchText}'.`
                        );

                        links.forEach((link, index) => {
                            console.log(
                                `[DEBUG] Checking link ${index + 1}:`,
                                link.outerHTML
                            );

                            const onclickCode = link.getAttribute("onclick");
                            if (onclickCode) {
                                console.log(
                                    `[DEBUG] Executing onclick on link ${index + 1}:`,
                                    onclickCode
                                );
                                if (onclickCode.trim().startsWith("return")) {
                                    const code = onclickCode.replace(/^return\s+/, "");
                                    console.log(
                                        `[DEBUG] Executing onclick after removing 'return':`,
                                        code
                                    );
                                    eval(code);
                                } else {
                                    console.log(`[DEBUG] Executing onclick as is:`, onclickCode);
                                    eval(onclickCode);
                                }
                            } else {
                                const link = Array.from(document.querySelectorAll("a")).find(
                                    (a) => a.textContent.trim() === "" + searchText + ""
                                );

                                const eventOptions = {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window,
                                };
                                link.dispatchEvent(new MouseEvent("mouseover", eventOptions));
                                link.dispatchEvent(new MouseEvent("mousedown", eventOptions));
                                link.dispatchEvent(new MouseEvent("mouseup", eventOptions));
                                link.dispatchEvent(new MouseEvent("click", eventOptions));
                                console.log("[DEBUG] Native click executed.");
                            }
                        });
                    }, action.searchText);
                    console.log("[DEBUG] XPath click logic completed");
                } catch (err) {
                    console.error("[DEBUG] Error waiting for XPath:", err);
                }
            } else {
                console.log("[DEBUG] Waiting for selector:", action.selector);

                try {
                    await page.waitForSelector(action.selector, {
                        visible: true,
                        timeout: 60000,
                    });
                    console.log(
                        "[DEBUG] Selector found, scrolling into view:",
                        action.selector
                    );

                    await page.waitForFunction(
                        (selector) => {
                            const el = document.querySelector(selector);
                            return el && !el.disabled;
                        },
                        { timeout: 60000 },
                        action.selector
                    );
                    console.log(
                        "[DEBUG] Element enabled, ready to click:",
                        action.selector
                    );

                    console.log(
                        "[DEBUG] Triggering native click event for:",
                        action.selector
                    );
                    await page.click(action.selector);
                    console.log("[DEBUG] Native click executed:", action.selector);

                    console.log("[DEBUG] Click executed, waiting for navigation.");

                    if (action.initiatesDownload) {
                        console.log("[DEBUG] Setting up download behavior...");

                        const client = await page.createCDPSession();
                        console.log("[DEBUG] CDP session created");
                        await client.send("Browser.setDownloadBehavior", {
                            behavior: "allowAndName",
                            downloadPath: reportDownloadDir,
                            eventsEnabled: true,
                        });
                        console.log("[DEBUG] Download behavior set");

                        const prefix = action.filePrefix || "";
                        const readableDate = format(new Date(), "yyyyMMdd_HHmmss");
                        const creds = configManager.getCurrentRunInputs(sheetId);
                        const downloadDir = reportDownloadDir;

                        console.log("[DEBUG] Waiting for download to complete...");
                        const finalFilePath = await waitUntilDownload(
                            client,
                            downloadDir,
                            readableDate + "-" + prefix + "-",
                            creds
                        );
                        console.log("[DEBUG] Download completed:", finalFilePath);
                        await client.detach();
                        console.log("[DEBUG] CDP session detached");
                    }
                } catch (err) {
                    console.error("[DEBUG] Error clicking element for selector:", err);
                }
            }
            console.log("[DEBUG] Click action completed");
            break;

        case "type":
            console.log("[DEBUG] Type action object:", action);

            let value = action.value;

            if (value === "dynamic-date") {
                value = getDynamicDate(action.month);
                console.log("[DEBUG] Using dynamic date:", value);
            }
            console.log(
                "[DEBUG] Typing in selector:",
                action.selector,
                "value:",
                value
            );
            await page.waitForSelector(action.selector, {
                visible: true,
                timeout: 60000,
            });
            console.log("[DEBUG] Selector found for typing:", action.selector);
            await page.type(action.selector, value, { delay: 100 });
            console.log("[DEBUG] Typing completed for selector:", action.selector);
            break;

        case "logout":
            console.log("[DEBUG] Logout action object:", action);

            if (!action.steps || !Array.isArray(action.steps)) {
                console.log("[DEBUG] Logout steps not defined or invalid.");
                break;
            }

            for (const step of action.steps) {
                console.log(
                    `[DEBUG] Waiting for logout step: ${step.description} (${step.selector})`
                );
                await page.waitForSelector(step.selector, {
                    visible: true,
                    timeout: 60000,
                });
                console.log(`[DEBUG] Found logout step, clicking: ${step.selector}`);
                await page.click(step.selector);
                console.log(`[DEBUG] Clicked logout step: ${step.selector}`);
            }

            console.log("[DEBUG] Logout action completed.");
            break;

        case "keyboard":
            console.log("Executing keyboard action:",
              action.description || action.key)
            if (action.key) {
              await page.keyboard.press(action.key, { delay: 100 });
              console.log(`Pressed key: ${action.key}`);
            }
            break;
            
        default:
            console.log(`[DEBUG] Unknown action type: ${action.type}`);
    }
    console.log("[DEBUG] runAction completed for type:", action.type);
}

async function runActions(sheetId, page, actions) {
    console.log("[DEBUG] runActions called with:", { sheetId, actions });
    for (const action of actions) {
        console.log("[DEBUG] Running action:", action);
        await runAction(sheetId, page, action);
        console.log("[DEBUG] Finished action:", action.type);
    }
    console.log("[DEBUG] runActions completed");
}

module.exports = { runActions };
