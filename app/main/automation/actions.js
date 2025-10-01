const { logger } = require("../logger");
const { sleep } = require("../utils");
const { waitUntilDownload } = require("../download-helper");

async function runAction(sheetId, page, action) {
  switch (action.type) {
    case "wait":
      await sleep(action.duration);
      break;

    case "click":
      logger.info("Executing click:", action.description || action.selector);
      console.log("[DEBUG] Click action object:", action);

      if (action.selector.startsWith("//")) {
        action.selector = action.selector.replace(
          "{{searchText}}",
          action.searchText
        );
        logger.info(`[DEBUG] Waiting for XPath: ${action.selector}`);
        try {
          // Wait until element appears in the DOM
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
        } catch (err) {
          logger.error("[DEBUG] Error waiting for XPath:", err.message);
          console.error("[DEBUG] Error waiting for XPath:", err);
        }
      } else {
        // CSS selector path
        logger.info(`[DEBUG] Waiting for selector: ${action.selector}`);
        console.log("[DEBUG] Waiting for selector:", action.selector);

        try {
          await page.waitForSelector(action.selector, {
            visible: true,
            timeout: 60000,
          });
          logger.info(
            "[DEBUG] Selector found, scrolling into view.",
            action.selector
          );
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

          logger.info("[DEBUG] Triggering native click event.");
          await page.click(action.selector);
          console.log("[DEBUG] Native click executed:", action.selector);

          logger.info("[DEBUG] Click executed, waiting for navigation.");

          // flag to determine the download behavior
          if (action.initiatesDownload) {
            logger.info("[DEBUG] Setting up download behavior...");
            console.log("[DEBUG] Setting up download behavior...");

            const client = await page.createCDPSession();
            await client.send("Browser.setDownloadBehavior", {
              behavior: "allowAndName",
              downloadPath: reportDownloadDir,
              eventsEnabled: true,
            });

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
            logger.info("[DEBUG] Download completed:", finalFilePath);
            console.log("[DEBUG] Download completed:", finalFilePath);
            // Clean up session after download
            await client.detach();
          }
        } catch (err) {
          logger.error(
            "[DEBUG] Error clicking element for selector:",
            err.message
          );
          console.error("[DEBUG] Error clicking element for selector:", err);
        }
      }
      break;

    case "type":
      logger.info("Executing type:", action.description || action.selector);

      let value = action.value;

      if (value === "dynamic-date") {
        value = getDynamicDate(action.month);
        logger.info("Using dynamic date:", value);
      }
      logger.info("typed in ", action.selector, " value: ", value);
      await page.waitForSelector(action.selector, {
        visible: true,
        timeout: 60000,
      });
      await page.type(action.selector, value, { delay: 100 });
      logger.info("Typing completed.");
      break;

    case "logout":
      logger.info("Executing logout");

      if (!action.steps || !Array.isArray(action.steps)) {
        logger.error("Logout steps not defined or invalid.");
        break;
      }

      for (const step of action.steps) {
        logger.info(`Waiting for: ${step.description} (${step.selector})`);
        await page.waitForSelector(step.selector, {
          visible: true,
          timeout: 60000,
        });
        logger.info(`Found ${step.description}, clicking...`);
        await page.click(step.selector);
      }

      logger.info("Logout action completed.");
      break;

    default:
      logger.warn(`Unknown action type: ${action.type}`);
  }
}

async function runActions(sheetId, page, actions) {
  for (const action of actions) {
    await runAction(sheetId, page, action);
  }
}

module.exports = { runActions };
