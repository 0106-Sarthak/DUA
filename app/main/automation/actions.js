const { waitUntilDownload } = require("../download-helper");
const { format } = require("date-fns");
const configManager = require("../config-manager");
const reportDownloadDir = require("../constants").reportDownloadDir;
const logger = require("../logger");

function sleep(ms) {
  console.log(`[DEBUG] sleep called with ms: ${ms}`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDynamicDate(monthsAgo) {
  const today = new Date();
  today.setMonth(today.getMonth() - monthsAgo);
  today.setDate(1);
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  const result = `>=${day}/${month}/${year}`;
  logger.debug(`getDynamicDate result: ${result}`);
  return result;
}

async function tryOutfilters(page, action) {
  const MAX_PAGES = 30;
  let found = false;

  for (let i = 0; i < MAX_PAGES; i++) {
    // 🔍 Try to find and click the target element
    found = await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          })
        );
        return true;
      }
      return false;
    }, action.selector);

    if (found) {
      logger.debug(`Element found and clicked on page ${i + 1}`);
      return true;
    }

    // Click the "Next record set" button dynamically
    const nextClicked = await page.evaluate(() => {
      // Find all visible "Next record set" spans (works even if IDs differ)
      const nextSpan = [
        ...document.querySelectorAll("span[title='Next record set']"),
      ].find((span) => span.offsetParent !== null); // ensure it's visible

      if (!nextSpan) {
        return false;
      }

      const eventOptions = { bubbles: true, cancelable: true, view: window };

      // Dispatch real mouse events to simulate a user click
      nextSpan.dispatchEvent(new MouseEvent("mouseover", eventOptions));
      nextSpan.dispatchEvent(new MouseEvent("mousedown", eventOptions));
      nextSpan.dispatchEvent(new MouseEvent("mouseup", eventOptions));
      nextSpan.dispatchEvent(new MouseEvent("click", eventOptions));

      return true;
    });

    if (!nextClicked) {
      logger.debug("Next button missing or disabled, pagination ended.");
      break;
    }

    logger.debug("Clicked Next record set, waiting for table to load...");
    await sleep(1500); 
  }

  logger.warn("Element not found after all pages:", action.selector);
  return false;
}

async function runAction(sheetId, page, action) {
  const currentInputs = configManager.getCurrentRunInputs(sheetId) || {};
  const activePosition = currentInputs.activePosition || null;

  // check whether the action is of type dynamicPosition
  if (action.dynamicPosition === true) {
    if (!activePosition) {
      logger.warn("No activePosition found for dynamicPosition action");
      return;
    }

    action.selector = `td[title='${activePosition}']`;
    logger.debug(`Using dynamic selector: ${action.selector}`);
  }

  switch (action.type) {
    case "launch":
      try {
        await page.goto(action.site, {
          waitUntil: "networkidle2",
          timeout: 60000,
        });
      } catch (err) {
        logger.debug(`Navigation failed: ${err.message}`);
        try {
          logger.debug("Attempting to reload the page...");
          await page.reload({
            waitUntil: "networkidle2",
            timeout: 60000,
          });
          logger.debug("Reload successful");
        } catch (reloadErr) {
          logger.debug(`Reload failed: ${reloadErr.message}`);
        }
      }
      break;

    case "wait":
      await sleep(action.duration);
      break;

    case "click":
      if (action.selector.startsWith("//")) {
        action.selector = action.selector.replace(
          "{{searchText}}",
          action.searchText
        );
        logger.debug(`Waiting for XPath: ${action.selector}`);
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
          logger.debug("XPath element found, executing click logic.");

          await page.evaluate((searchText) => {
            const links = Array.from(document.querySelectorAll("a")).filter(
              (a) => a.textContent.includes(`${searchText}`)
            );

            if (links.length === 0) {
              return;
            }

            links.forEach((link, index) => {
              const onclickCode = link.getAttribute("onclick");
              if (onclickCode) {               
                if (onclickCode.trim().startsWith("return")) {
                  const code = onclickCode.replace(/^return\s+/, "");
                  eval(code);
                } else {
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
              }
            });
          }, action.searchText);
        } catch (err) {
          logger.error("[DEBUG] Error waiting for XPath:", err);
        }
      } else {
        logger.debug(`Waiting for selector: ${action.selector}`);

        try {
          if (action.dynamicPosition) {
            const success = await tryOutfilters(page, action);
            if (success) {
              break;
            } else {
              logger.debug(
                "[DEBUG] Dynamic element not found after pagination, continuing normal click."
              );
            }
          }
          await page.click(action.selector);
          if (action.initiatesDownload) {
            logger.debug("Setting up download behavior...");

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

            const finalFilePath = await waitUntilDownload(
              client,
              downloadDir,
              readableDate + "-" + prefix + "-",
              creds
            );
            logger.debug("[DEBUG] Download completed:", finalFilePath);
            await client.detach();
          }
        } catch (err) {
          logger.error("Error clicking element for selector:", err);
        }
      }
      logger.debug("[DEBUG] Click action completed");
      break;

    case "type":
      let value = action.value;

      if (value === "dynamic-date") {
        value = getDynamicDate(action.month);
        logger.debug("[DEBUG] Using dynamic date:", value);
      }
      await page.waitForSelector(action.selector, {
        visible: true,
        timeout: 60000,
      });
      await page.type(action.selector, value, { delay: 100 });
      break;

    case "logout":
      if (!action.steps || !Array.isArray(action.steps)) {
        break;
      }

      for (const step of action.steps) {
        await page.waitForSelector(step.selector, {
          visible: true,
          timeout: 60000,
        });
        await page.click(step.selector);
      }

      logger.debug("[DEBUG] Logout action completed.");
      break;

    case "keyboard":
      if (action.key) {
        await page.keyboard.press(action.key, { delay: 100 });
      }
      break;

    default:
      logger.debug(`[DEBUG] Unknown action type: ${action.type}`);
  }
  logger.debug("[DEBUG] runAction completed for type:", action.type);
}

async function runActions(sheetId, page, actions) {
  for (const action of actions) {
    await runAction(sheetId, page, action);
  }
  logger.debug("All actions completed for sheetId:", sheetId);
}

module.exports = { runActions };
