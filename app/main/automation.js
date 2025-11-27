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
logger.info("Chrome executable path:", chromePath);

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

    await refreshUserInput();

    // Extract all unique users
    const allUsers = {};
    for (const [sheetId, sheetData] of Object.entries(userInputStore)) {
      for (const creds of sheetData.inputs || []) {
        const key = creds.userId || creds.username;
        if (!allUsers[key]) allUsers[key] = creds;
      }
    }
    
    // const runSheets = [0, 2, 5];
    

    for (const [userKey, creds] of Object.entries(allUsers)) {
      logger.info(`=== Starting run for ${userKey} ===`);
      const runSheets = creds.runSheets;
      const { browser: userBrowser, page } = await launchBrowser();
      browser = userBrowser;

      const positions =
        creds.activePositions?.length > 0 ? creds.activePositions : [null];

      const sheets = configuration.action_sheets;

      const loginSheet = sheets[0]; // sheet-1
      const logoutSheet = sheets[sheets.length - 1]; // sheet-N (last)

      // ---------------------------
      // LOGIN ONCE
      // ---------------------------
      {
        const sheet = loginSheet;
        const sheetPath = path.join(ACTION_SHEETS_DIR, sheet.name + ".json");

        const actionSheet = forget(sheetPath);
        configManager.setCurrentRunInputs(sheet.id, creds);

        logger.info(`LOGIN: Running ${sheet.name}`);

        const success = await runWorkflow(
          sheet.id,
          actionSheet,
          configuration,
          page
        );
        if (!success) {
          logger.error(`Login failed`);
          await userBrowser.close();
          continue;
        }
      }

      // ---------------------------
      // RUN REPORTS FOR EACH POSITION
      // ---------------------------
      for (const position of positions) {
        logger.info(`\nPosition: ${position}`);

        for (let i = 1; i < sheets.length - 1; i++) {
          const sheet = sheets[i];

          const sheetNumber = sheet.number;

          // skip if sheet.number not in runSheets
          if (
            sheetNumber !== undefined &&
            runSheets.length > 0 &&
            !runSheets.includes(sheetNumber)
          ) {
            continue;
          }

          const pathToSheet = path.join(
            ACTION_SHEETS_DIR,
            sheet.name + ".json"
          );
          const actionSheet = forget(pathToSheet);

          configManager.setCurrentRunInputs(sheet.id, {
            ...creds,
            activePosition: position,
          });

          logger.info(`Running ${sheet.name} @ ${position}`);

          const success = await runWorkflow(
            sheet.id,
            actionSheet,
            configuration,
            page
          );

          // in case of any errors continue to next sheet
          if (!success) {
            logger.error(`Failed at ${sheet.name}`);
            continue;
          }
        }
      }

      // ---------------------------
      // LOGOUT ONCE
      // ---------------------------
      {
        const sheet = logoutSheet;
        const pathToSheet = path.join(ACTION_SHEETS_DIR, sheet.name + ".json");
        const actionSheet = forget(pathToSheet);

        configManager.setCurrentRunInputs(sheet.id, creds);

        logger.info(`LOGOUT: Running ${sheet.name}`);

        await runWorkflow(sheet.id, actionSheet, configuration, page);
      }

      await userBrowser.close();
      browser = null;
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