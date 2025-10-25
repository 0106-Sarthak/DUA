const fs = require("fs");
const path = require("path");
const cronParser = require("cron-parser");
const CronExpressionParser =
  cronParser.CronExpressionParser || cronParser.default;
const forget = require("require-and-forget");
const configManager = require("./config-manager");
const { runWorkflow } = require("./automation/workflow");
const { launchBrowser } = require("./automation/browser");
const logger = require("./logger");

// Chrome path (Windows)
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
console.log("Chrome executable path:", chromePath);

// Base directories
const BASE_DIR = "C:\\DuaReports";
const CONFIG_DIR = path.join(BASE_DIR, "config");
const REPORTS_DIR = path.join(BASE_DIR, "reports");
const ACTION_SHEETS_DIR = path.join(BASE_DIR, "sheets");
const LOGS_DIR = path.join(BASE_DIR, "logs");

// Ensure directories exist
[BASE_DIR, CONFIG_DIR, REPORTS_DIR, ACTION_SHEETS_DIR, LOGS_DIR].forEach(
  (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
);

// Config & user input files
const configFilePath = path.join(CONFIG_DIR, "config.json");
const userInputFilePath = path.join(CONFIG_DIR, "user-input.json");

// Puppeteer report download folder
const reportDownloadDir = REPORTS_DIR;
if (!fs.existsSync(reportDownloadDir))
  fs.mkdirSync(reportDownloadDir, { recursive: true });

// User input store
let userInputStore = {};
const refreshUserInput = async () => {
  try {
    if (fs.existsSync(userInputFilePath)) {
      userInputStore = JSON.parse(fs.readFileSync(userInputFilePath, "utf8"));
      logger.info("User input refreshed:", userInputStore);
    }
  } catch (err) {
    logger.error("Error reading user input file", err);
  }
};

// Main automation loop
let configuration;
let busy = false;

async function main() {
  if (busy) {
    logger.info("Automation already running, skipping this run.");
    return;
  }
  busy = true;

  let browser;

  try {
    if (!fs.existsSync(configFilePath)) {
      logger.error("Configuration file not found at", configFilePath);
      busy = false;
      return;
    }

    configuration = JSON.parse(fs.readFileSync(configFilePath, "utf8"));
    logger.info("Loaded configuration:", configuration);

    await refreshUserInput();

    // Extract all unique users
    const allUsers = {};
    for (const [sheetId, sheetData] of Object.entries(userInputStore)) {
      for (const creds of sheetData.inputs || []) {
        const key = creds.userId || creds.username;
        if (!allUsers[key]) allUsers[key] = creds;
      }
    }

    // ----- Labeled loop for sheets -----
    for (const [userKey, creds] of Object.entries(allUsers)) {
      logger.info(`\n=== Starting all sheets for user: ${userKey} ===`);

      const { browser: userBrowser, page } = await launchBrowser();
      browser = userBrowser;

      outerSheetLoop: for (const sheet of configuration.action_sheets || []) {
        const sheetPath = path.join(ACTION_SHEETS_DIR, sheet.name + ".json");
        if (!fs.existsSync(sheetPath)) {
          logger.warn(`Action sheet not found: ${sheetPath}`);
          continue;
        }

        const actionSheet = forget(sheetPath);

        // Check cron schedule (same logic as before)
        let shouldRun = false;
        const now = new Date();
        for (const cronExpr of Object.values(sheet.config?.runtimes || {})) {
          try {
            const interval = CronExpressionParser.parse(cronExpr, {
              currentDate: new Date(now.getTime() - 1000),
            });
            const next = interval.next().toDate();
            if (
              Math.abs(next.getTime() - now.getTime()) < 60000 &&
              (!alreadyRan[sheet.id] ||
                alreadyRan[sheet.id].getTime() !== next.getTime())
            ) {
              shouldRun = true;
              alreadyRan[sheet.id] = next;
              break;
            }
          } catch (err) {
            console.error(`Cron error in ${sheet.name}:`, err.message);
          }
        }

        if (!shouldRun) {
          console.log(`Skipping sheet ${sheet.name} for ${userKey}.`);
          continue;
        }

        console.log(`➡️ Running sheet ${sheet.name} for ${userKey}`);
        configManager.setCurrentRunInputs(sheet.id, creds);

          try {
            const success = await runWorkflow(
              sheet.id,
              actionSheet,
              configuration,
              page
            );
            if (!success) {
              logger.error(`Sheet ${sheet.name}${
                  position ? ` at ${position}` : ""
                } failed for ${userKey}, stopping all sheets for this user.`);
              break outerSheetLoop; // <--- STOP all sheets for this user
            }

            logger.info(`✅ Finished ${sheet.name}${
              position ? ` at ${position}` : ""
            } for ${userKey}`);
          } catch (err) {
            logger.error(
              `Error in ${sheet.name}${
                position ? ` at ${position}` : ""
              } for ${userKey}:`,
              err.message
            );
            break outerSheetLoop;
          }
        }
      }

      await userBrowser.close();
      browser = null;
      logger.info(`=== Completed all sheets for ${userKey} ===`);
    }
  } catch (err) {
    logger.error("Error in main:", err.message);
  } finally {
    if (browser) {
      logger.info("Closing leftover browser...");
      await browser.close();
    }
    busy = false;
  }
}

async function start() {
  console.log("Automation started...");
  await main();
  console.log("Automation finished. Exiting...");
  process.exit(0);
}

module.exports = { start };
