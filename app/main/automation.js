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
logger.info("Chrome executable path:", chromePath)

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
        // const isSheet2 = sheet.name === "sheet-2";

        const shouldLoop = sheet.multi_postion === true;

        // Determine loop array: for sheet-2, iterate over activePositions
        let loopArray = [null];
        if (
          shouldLoop &&
          creds.activePositions &&
          creds.activePositions.length > 0
        ) {
          loopArray = creds.activePositions;
        }

        for (const position of loopArray) {
          if (position) {
            
            configManager.setCurrentRunInputs(sheet.id, {
              ...creds,
              activePosition: position,
            });
            logger.info(`🔁 Running ${sheet.name} for user ${userKey} at position ${position}`);
          } else {
            logger.info(`🔁 Running ${sheet.name} for user ${userKey}`);
            configManager.setCurrentRunInputs(sheet.id, creds);
          }

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
  logger.info("Automation started...");
  await main();
  logger.info("Automation finished. Exiting...");
  process.exit(0);
}

module.exports = { start };