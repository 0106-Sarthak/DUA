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

function loadSheetFile(sheetIdOrName) {
  const sheetPath = path.join(ACTION_SHEETS_DIR, `${sheetIdOrName}.json`);
  if (!fs.existsSync(sheetPath)) return null;

  return JSON.parse(fs.readFileSync(sheetPath, "utf8"));
}

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
    logger.info("Automation already running, skipping.");
    return;
  }
  busy = true;

  let browser;

  try {
    if (!fs.existsSync(configFilePath)) {
      logger.error("Configuration file not found:", configFilePath);
      busy = false;
      return;
    }

    configuration = JSON.parse(fs.readFileSync(configFilePath, "utf8"));
    await refreshUserInput();

    // Extract all unique users
    const allUsers = {};
    for (const [sheetId, sheetData] of Object.entries(userInputStore)) {
      for (const creds of sheetData.inputs || []) {
        const key = creds.userId;
        if (!allUsers[key]) allUsers[key] = creds;
      }
    }

    for (const [userKey, creds] of Object.entries(allUsers)) {
      logger.info(`=== Starting run for ${userKey} ===`);

      const { browser: userBrowser, page } = await launchBrowser();
      browser = userBrowser;

      const sheets = configuration.action_sheets;
      const loginSheet = sheets[0];
      const logoutSheet = sheets[sheets.length - 1];

      // ------------------------ LOGIN ------------------------
      {
        const sheetPath = path.join(
          ACTION_SHEETS_DIR,
          loginSheet.name + ".json"
        );
        const actionSheet = forget(sheetPath);

        configManager.setCurrentRunInputs(loginSheet.id, creds);
        logger.info(`LOGIN: Running ${loginSheet.name}`);
        const success = await runWorkflow(
          loginSheet.id,
          actionSheet,
          configuration,
          page
        );

        if (!success) {
          logger.error("Login failed");
          await userBrowser.close();
          continue;
        }
      }

      // ------------------------ RUN SHEETS PER POSITION ------------------------
      for (const posObj of creds.positions) {
        const posName = posObj.position;
        const posRunSheets = posObj.runSheets ?? [];

        logger.info(`\nPosition: ${posName}`);
        logger.info(`RunSheets: ${JSON.stringify(posRunSheets)}`);

        // Run all sheets once
        for (let i = 1; i < sheets.length - 1; i++) {
          const sheet = sheets[i];
          if (
            sheet.number !== undefined &&
            !posRunSheets.includes(sheet.number)
          )
            continue;

          const sheetPath = path.join(ACTION_SHEETS_DIR, sheet.name + ".json");
          const actionSheet = forget(sheetPath);

          configManager.setCurrentRunInputs(sheet.id, {
            ...creds,
            activePosition: posName,
          });

          await runWorkflow(sheet.id, actionSheet, configuration, page);
          logger.info(`Sheet ${sheet.name} completed (first run).`);
        }

        const dealerSafe = creds.dealerName.replace(/\W+/g, "_");
        const positionSafe = posName.replace(/\W+/g, "-");

        const downloadDir = path.join(REPORTS_DIR, dealerSafe, positionSafe);

        // Check downloads after all sheets
        let files = [];
        if (fs.existsSync(downloadDir)) {
          files = fs.readdirSync(downloadDir);
        } else {
          logger.warn(`Download directory missing: ${downloadDir}`);
        }

        const missingSheets = posRunSheets.filter((sheetNum) => {
          const sheetMeta = sheets.find((s) => s.number === sheetNum);
          if (!sheetMeta) return false;

          // load actual sheet file
          const sheetFull = loadSheetFile(sheetMeta.name || sheetMeta.id);
          if (!sheetFull) return false;

          const downloadPrefixes = (sheetFull.actions || [])
            .filter(a => a.initiatesDownload && a.filePrefix)
            .map(a => a.filePrefix);

          // If sheet has no expected downloads → cannot be missing
          if (downloadPrefixes.length === 0) return false;

          // Otherwise check if folder has a file for any prefix
          const hasFile = files.some((f) =>
            downloadPrefixes.some((pref) => f.includes(pref))
          );

          return !hasFile; // missing if no file found
        });

        // Retry missing downloads
        if (missingSheets.length > 0) {
          logger.warn(
            `Missing downloads for ${posName}: ${missingSheets.join(", ")}`
          );

          for (const missingSheetNum of missingSheets) {
            const sheet = sheets.find((s) => s.number === missingSheetNum);
            if (!sheet) continue;

            const sheetPath = path.join(
              ACTION_SHEETS_DIR,
              sheet.name + ".json"
            );
            const actionSheet = forget(sheetPath);

            configManager.setCurrentRunInputs(sheet.id, {
              ...creds,
              activePosition: posName,
            });

            logger.info(`Retrying missing sheet ${sheet.name} @ ${posName}`);
            await runWorkflow(sheet.id, actionSheet, configuration, page);
          }
        } else {
          logger.info(`All downloads present for ${posName}`);
        }
      }

      // ------------------------ LOGOUT ------------------------
      {
        const sheetPath = path.join(
          ACTION_SHEETS_DIR,
          logoutSheet.name + ".json"
        );
        const actionSheet = forget(sheetPath);

        configManager.setCurrentRunInputs(logoutSheet.id, creds);
        logger.info(`LOGOUT: Running ${logoutSheet.name}`);
        await runWorkflow(logoutSheet.id, actionSheet, configuration, page);
      }

      await userBrowser.close();
      browser = null;
    }
  } catch (err) {
    logger.error("Error in main:", err.message);
  } finally {
    if (browser) await browser.close();
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
