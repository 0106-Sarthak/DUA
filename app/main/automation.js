const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const superagent = require("superagent");
const cronParser = require("cron-parser");
const CronExpressionParser =
  cronParser.CronExpressionParser || cronParser.default;
const forget = require("require-and-forget");
const { parse, format } = require("date-fns");
const configManager = require("./config-manager");
const logger = require("./logger");
const { runWorkflow } = require("./automation/workflow");

// Set Chrome executable path for Windows
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
logger.info("Chrome executable path:", chromePath);

// const BASE_DIR = process.env.DUA_DATA_PATH || "C:\\dua-data";
// const BASE_DIR = path.join(__dirname, "../data");
// logger.info("Project dir:", BASE_DIR);

const BASE_DIR = "C:\\DuaReports";
const CONFIG_DIR = path.join(BASE_DIR, "config");
const REPORTS_DIR = path.join(BASE_DIR, "reports");
const ACTION_SHEETS_DIR = path.join(BASE_DIR, "sheets");
const LOGS_DIR = path.join(BASE_DIR, "logs");

// const PROPER_DIRNAME = path.join(app.getPath("userData"));*

// Ensure base directories exist
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
}

const configFilePath = path.join(BASE_DIR, "config", "config.json");
const userInputFilePath = path.join(BASE_DIR, "config", "user-input.json");
const actionSheetsDir = path.join(BASE_DIR, "sheets");
const logsDir = path.join(BASE_DIR, "logs");
const reportsDir = path.join(BASE_DIR, "reports");

[CONFIG_DIR, REPORTS_DIR, ACTION_SHEETS_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

logger.info("Config file path:", configFilePath);
logger.info("User input file path:", userInputFilePath);
logger.info("Action sheets dir:", actionSheetsDir);
logger.info("Logs dir:", logsDir);
logger.info("Reports dir:", reportsDir);

// Ensure action-sheets folder exists
if (!fs.existsSync(actionSheetsDir))
  fs.mkdirSync(actionSheetsDir, { recursive: true });

// Utility Functions

const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

function getDynamicDate(monthsAgo) {
  const today = new Date();

  // subtract specified months
  today.setMonth(today.getMonth() - monthsAgo);

  // set to 1st day of that month
  today.setDate(1);

  // format as dd/mm/yyyy
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0"); // months are 0-based
  const year = today.getFullYear();

  return `>=${day}/${month}/${year}`;
}

const getCurrentDate = () => formatDate(new Date());
const getYesterday = () => formatDate(new Date(Date.now() - 86400000));

const generateDateForToken = (token) => {
  if (token === "today") return getCurrentDate();
  if (token === "yesterday") return getYesterday();
  return "";
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// User Input Store
let userInputStore = {};
const refreshUserInput = async () => {
  try {
    if (fs.existsSync(userInputFilePath)) {
      userInputStore = JSON.parse(fs.readFileSync(userInputFilePath, "utf8"));
    }
  } catch (err) {
    logger.error("Error reading user input file", err);
  }
};

// Puppeteer & ActionSheet Executor
const reportDownloadDir = path.join(BASE_DIR, "reports");

if (!fs.existsSync(reportDownloadDir))
  fs.mkdirSync(reportDownloadDir, { recursive: true });

async function waitUntilDownload(
  session,
  downloadPath = "",
  fileName = "",
  creds = {}
) {
  return new Promise((resolve, reject) => {
    const guids = {};

    session.on("Browser.downloadWillBegin", (event) => {
      guids[event.guid] = fileName + event.suggestedFilename;
    });

    session.on("Browser.downloadProgress", (e) => {
      if (e.state === "completed") {
        try {
          // Extract dealer & location safely
          const dealerRaw = creds.Dealer_name || creds.dealerName || "";
          const locationRaw = creds.Location || creds.location || "";

          const dealerSafe = dealerRaw.toString().replace(/\s+/g, "_");
          const locationSafe = locationRaw.toString().replace(/\s+/g, "_");

          // Build directory path
          let targetDir = downloadPath;
          if (dealerSafe) targetDir = path.join(targetDir, dealerSafe);
          if (locationSafe) targetDir = path.join(targetDir, locationSafe);

          fs.mkdirSync(targetDir, { recursive: true });

          const sourcePath = path.resolve(downloadPath, e.guid);
          const destPath = path.resolve(targetDir, guids[e.guid]);

          logger.info("Dealer safe:", dealerSafe);
          logger.info("Location safe:", locationSafe);
          logger.info("Target directory:", targetDir);

          fs.renameSync(sourcePath, destPath);
          logger.info("Download moved to:", destPath);

          resolve(destPath);
        } catch (err) {
          reject(err);
        }
      } else if (e.state === "canceled") {
        reject(new Error("Download canceled"));
      }
    });
  });
}


const initiateProcess = async (sheetId, actionSheet, configuration) => {
  let browser;
  let page;
  // Listen for dialog popups like 'beforeunload'
  let loginFailed = false;
  let loginBlocked = false;

  try {
    // browser = await launchBrowser();
    browser = await puppeteer.launch({
      headless: false,
      executablePath: chromePath,
      defaultViewport: null,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
    });

    console.log("Browser launched");

    page = await browser.newPage();

    page.on("dialog", async (dialog) => {
      const msg = dialog.message();
      logger.info(`Dialog appeared: ${msg}`);

      if (msg.includes("Max Concurrent Sessions")) {
        logger.info(
          "Max concurrent sessions reached. Dismissing dialog and skipping login..."
        );
        await dialog.dismiss();
        loginBlocked = true;
      } else {
        await dialog.dismiss();
      }
    });

    await page.setCacheEnabled(false);
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/116.0.5845.140 Safari/537.36"
    );

    // Process each action
    for (const key in actionSheet.actions) {
      const action = actionSheet.actions[key];
      if (loginFailed) {
        logger.info("Skipping remaining actions due to login failure");
        break;
      }
      logger.info("\nAction raw object:", action);
      logger.info("Processing action:", action.type);

      try {
        // Wait 1-2 seconds before each action
        // Wait for a visible body as a generic delay
        await page.waitForSelector("body", { visible: true, timeout: 60000 });
        logger.info(`Executing action: ${action.type}`);

        switch (action.type) {
          case "launch":
            logger.info("Launching site:", action.site);
            try {
              await page.goto(action.site, {
                waitUntil: "networkidle2",
                timeout: 60000,
              });
              logger.info("Navigation complete:", action.site);
            } catch (err) {
              logger.error("Navigation failed:", err.message);
              // Attempt a reload
              try {
                logger.info("Attempting to reload the page...");
                await page.reload({
                  waitUntil: "networkidle2",
                  timeout: 60000,
                });
                logger.info("Reload successful");
              } catch (reloadErr) {
                logger.error("Reload failed:", reloadErr.message);
              }
            }
            break;

          case "wait":
            logger.info(`Waiting for ${action.duration}ms...`);
            await sleep(action.duration);
            break;

          case "login":
            logger.info("Starting login action...");
            logger.info("Fields to fill:", action.fields);
            logger.info("Submit action:", action.submit);

            if (!action.fields || action.fields.length === 0) {
              logger.warn("No fields defined for login.");
            }

            for (const field of action.fields) {
              let value;
              if (field.useUserInput) {
                value = configManager.getUserInput(sheetId, field.inputToken);
              } else {
                value = field.value;
              }
              await page.type(field.selector, value);
            }

            if (action.submit && action.submit.selector) {
              logger.info("Submit selector found:", action.submit.selector);
              try {
                await page.waitForSelector(action.submit.selector, {
                  timeout: 60000,
                });
                logger.info("Submit selector is visible, clicking now...");
                await page.click(action.submit.selector);
                logger.info("Clicked submit button.");
              } catch (err) {
                logger.error(
                  "Submit selector not found or not clickable:",
                  err.message
                );
              }
            } else {
              logger.warn("Submit action not defined or missing selector.");
            }
            logger.info("Login action completed, waiting for navigation...");
            // Optionally wait after submitting
            if (action.waitAfterSubmit) {
              logger.info(`Waiting after submit...`);
              await page.waitForSelector("body", {
                visible: true,
                timeout: Math.max(action.waitAfterSubmit, 1000),
              });
            }

            logger.info("Checking for login failure indicators...");
            // Check for login failure indicators
            try {
              loginFailed = await page.waitForFunction(
                () => {
                  // Check for error message
                  const errEl = document.querySelector(
                    "#statusBar.siebui-error"
                  );
                  if (errEl) {
                    const text = errEl.innerText || "";
                    if (
                      text.includes("incorrect") ||
                      text.includes("SBL-UIF-00272")
                    )
                      return true;
                  }

                  // Optionally, check for element that confirms successful login
                  const successEl = document.querySelector(
                    "#some-dashboard-element"
                  );
                  if (successEl) return false;

                  // Keep waiting
                  return undefined;
                },
                { timeout: 7000 }
              ); // wait max 7s
            } catch (err) {
              // Timeout, assume login succeeded if no error appeared
              loginFailed = false;
            }
            if (loginBlocked) {
              loginFailed = true;
            }
            logger.info("Login failed status:", loginFailed);
            break;

          case "click":
            logger.info(
              "Executing click:",
              action.description || action.selector
            );
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
                const links = Array.from(
                document.querySelectorAll("a")
                ).filter((a) => a.textContent.includes(`${searchText}`));

                if (links.length === 0) {
                console.error(`[DEBUG] No links found containing '${searchText}'`);
                return;
                }
                console.log(`[DEBUG] Found ${links.length} link(s) containing '${searchText}'.`);

                links.forEach((link, index) => {
                console.log(`[DEBUG] Checking link ${index + 1}:`, link.outerHTML);

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
                  const link = Array.from(
                  document.querySelectorAll("a")
                  ).find(
                  (a) => a.textContent.trim() === "" + searchText + ""
                  );

                  const eventOptions = {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  };
                  link.dispatchEvent(
                  new MouseEvent("mouseover", eventOptions)
                  );
                  link.dispatchEvent(
                  new MouseEvent("mousedown", eventOptions)
                  );
                  link.dispatchEvent(
                  new MouseEvent("mouseup", eventOptions)
                  );
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
              console.log("[DEBUG] Selector found, scrolling into view:", action.selector);

              await page.waitForFunction(
                (selector) => {
                const el = document.querySelector(selector);
                return el && !el.disabled;
                },
                { timeout: 60000 },
                action.selector
              );
              console.log("[DEBUG] Element enabled, ready to click:", action.selector);

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

          case "keyboard":
            logger.info(
              "Executing keyboard action:",
              action.description || action.key
            );
            if (action.key) {
              await page.keyboard.press(action.key, { delay: 100 });
              logger.info(`Pressed key: ${action.key}`);
            }
            break;

          case "type":
            logger.info(
              "Executing type:",
              action.description || action.selector
            );

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

          case "upload":
            const inputUploadHandle = await page.$(action.selector);
            if (inputUploadHandle) {
              await inputUploadHandle.uploadFile(action.filePath);
              logger.info(`Uploaded file: ${action.filePath}`);
            } else {
              logger.info(`Could not find upload input: ${action.selector}`);
            }
            break;

          case "select":
            try {
              await page.select(action.selector, action.value);
              logger.info(
                `Selected value '${action.value}' for ${action.selector}`
              );
            } catch (err) {
              logger.error(
                `Failed to select '${action.value}' for ${action.selector}:`,
                err
              );
            }
            break;

          case "logout":
            logger.info("Executing logout");

            if (!action.steps || !Array.isArray(action.steps)) {
              logger.error("Logout steps not defined or invalid.");
              break;
            }

            for (const step of action.steps) {
              logger.info(
                `Waiting for: ${step.description} (${step.selector})`
              );
              await page.waitForSelector(step.selector, {
                visible: true,
                timeout: 60000,
              });
              logger.info(`Found ${step.description}, clicking...`);
              await page.click(step.selector);
            }

            logger.info("Logout action completed.");
            break;

          case "close":
            logger.info("Closing browser...");
            break;

          default:
            logger.warn("Unknown action type:", action.type);
        }
      } catch (err) {
        logger.error("Error executing action:", action.type, err.message);
      }
    }
  } catch (err) {
    console.log("Error initializing Puppeteer:", err);
    logger.error("Error initializing Puppeteer:", err);
  } finally {
    if (browser) {
      await browser.close();
      logger.info("Browser closed");
    }
  }

  return !loginFailed;
};

// Main Automation Loop
let configuration;
let busy = false;
let alreadyRan = {};

const deepMerge = (local, remote) => {
  const merged = { ...local };
  for (const key in remote) {
    if (remote.hasOwnProperty(key)) {
      merged[key] =
        typeof remote[key] === "object" && !Array.isArray(remote[key])
          ? deepMerge(merged[key] || {}, remote[key])
          : remote[key];
    }
  }
  return merged;
};

async function main() {
  if (busy) return;
  busy = true;

  try {
    logger.info("Checking configuration...");

    if (!fs.existsSync(configFilePath)) {
      logger.info("Configuration file not found at", configFilePath);
      busy = false;
      return;
    }

    configuration = JSON.parse(fs.readFileSync(configFilePath, "utf8"));
    logger.info(
      "Loaded configuration:",
      JSON.stringify(configuration, null, 2)
    );

    // Refresh user inputs
    await refreshUserInput();

    // Iterate action sheets
    for (const sheet of configuration.action_sheets || []) {
      const sheetPath = path.join(actionSheetsDir, sheet.name + ".json");
      logger.info("Checking action sheet:", sheet.name);

      if (!fs.existsSync(sheetPath)) {
        logger.info(`Action sheet file not found at ${sheetPath}`);
        continue;
      }

      const actionSheet = forget(sheetPath);

      logger.info("Sheet object:", JSON.stringify(sheet, null, 2));

      // Check if this sheet is scheduled to run now
      let shouldRun = false;
      const now = new Date();

      for (const cronExpr of Object.values(sheet.config?.runtimes || {})) {
        try {
          const interval = CronExpressionParser.parse(cronExpr, {
            currentDate: new Date(now.getTime() - 1000),
          });
          const next = interval.next().toDate();

          logger.info(
            `Cron schedule for ${
              sheet.name
            }: next run at ${next.toISOString()}, now is ${now.toISOString()}`
          );

          if (
            Math.abs(next.getTime() - now.getTime()) < 60000 &&
            (!alreadyRan[sheet.id] ||
              alreadyRan[sheet.id].getTime() !== next.getTime())
          ) {
            logger.info(`Action sheet ${sheet.name} is scheduled to run now.`);
            shouldRun = true;
            alreadyRan[sheet.id] = next;
            break;
          }
        } catch (err) {
          logger.error(`Cron error in ${sheet.name}:`, err.message);
        }
      }

      if (!shouldRun) {
        logger.info(`Skipping action sheet ${sheet.name}.`);
        continue;
      }

      // Run the sheet for each user
      const credsArray = userInputStore[sheet.id]?.inputs || [];
      if (credsArray.length === 0) {
        logger.info(`No user inputs found for sheet ${sheet.name}, skipping.`);
        continue;
      }

      for (const creds of credsArray) {
        logger.info(`Running sheet ${sheet.name} for user ${creds.userId}`);
        // Set current run inputs so actions can access them
        configManager.setCurrentRunInputs(sheet.id, creds);

        try {
          // const loginSucceeded = await initiateProcess(
          //   sheet.id,
          //   actionSheet,
          //   configuration
          // );
          const loginSucceeded = await runWorkflow(sheet.id, actionSheet, configuration);
          if (!loginSucceeded) {
            logger.info(
              `Login failed for user ${creds.userId}, skipping remaining actions.`
            );
            continue; // skip this user
          }
          logger.info(
            `Finished running sheet ${sheet.name} for user ${creds.userId}`
          );
        } catch (err) {
          logger.error(
            `Error running sheet ${sheet.name} for user ${creds.userId}:`,
            err.message
          );
        }
      }
    }
  } catch (err) {
    logger.error("Automation main loop error:", err);
  }

  busy = false;
}

// function start() {
//   logger.info("Automation started...");
//   setInterval(main, 2000);
// }

async function start() {
  logger.info("Automation started...");
  await main(); // run once
  logger.info("Automation finished. Exiting...");
  process.exit(0); 
}

module.exports = { start };
