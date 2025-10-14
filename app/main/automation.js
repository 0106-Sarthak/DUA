const fs = require("fs");
const path = require("path");
const cronParser = require("cron-parser");
const CronExpressionParser =
  cronParser.CronExpressionParser || cronParser.default;
const forget = require("require-and-forget");
const configManager = require("./config-manager");
const { runWorkflow } = require("./automation/workflow");
const { launchBrowser } = require("./automation/browser");

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
      console.log("Refreshed userInputStore:", userInputStore);
    }
  } catch (err) {
    console.error("Error reading user input file", err);
  }
};

// Main automation loop
let configuration;
let busy = false;

async function main() {
  if (busy) {
    console.log("Main loop is busy, skipping this run.");
    return;
  }
  busy = true;

  let browser;

  try {
    console.log("Checking configuration...");
    if (!fs.existsSync(configFilePath)) {
      console.log("Configuration file not found at", configFilePath);
      busy = false;
      return;
    }

    configuration = JSON.parse(fs.readFileSync(configFilePath, "utf8"));
    console.log("Loaded configuration:", configuration);

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
      console.log(`\n=== Starting all sheets for user: ${userKey} ===`);

      const { browser: userBrowser, page } = await launchBrowser();
      browser = userBrowser;

      outerSheetLoop: for (const sheet of configuration.action_sheets || []) {
        const sheetPath = path.join(ACTION_SHEETS_DIR, sheet.name + ".json");
        if (!fs.existsSync(sheetPath)) {
          console.log(`Action sheet not found: ${sheetPath}`);
          continue;
        }

        const actionSheet = forget(sheetPath);
        const isSheet2 = sheet.name === "sheet-2";

        // Determine loop array: for sheet-2, iterate over activePositions
        let loopArray = [null];
        if (
          isSheet2 &&
          creds.activePositions &&
          creds.activePositions.length > 0
        ) {
          loopArray = creds.activePositions;
        }

        for (const position of loopArray) {
          if (position) {
            console.log(
              `\n🔁 Running ${sheet.name} for activePosition: ${position}`
            );
            configManager.setCurrentRunInputs(sheet.id, {
              ...creds,
              activePosition: position,
            });
            console.log(
              "Current run inputs set to:",
              configManager.getUserInput(sheet.id)
            );
          } else {
            console.log(`\n🔁 Running ${sheet.name} for user ${userKey}`);
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
              console.log(
                `❌ Sheet ${sheet.name}${
                  position ? ` at ${position}` : ""
                } failed for ${userKey}, stopping all sheets for this user.`
              );
              break outerSheetLoop; // <--- STOP all sheets for this user
            }

            console.log(
              `✅ Finished ${sheet.name}${
                position ? ` at ${position}` : ""
              } for ${userKey}`
            );
          } catch (err) {
            console.error(
              `Error in ${sheet.name}${
                position ? ` at ${position}` : ""
              } for ${userKey}:`,
              err.message
            );
            break outerSheetLoop;
          }
        }
      }

      console.log(`Closing browser for ${userKey}`);
      await userBrowser.close();
      browser = null;
      console.log(`=== Completed all sheets for ${userKey} ===`);
    }
  } catch (err) {
    console.error("Error in main:", err.message);
  } finally {
    if (browser) {
      console.log("Closing leftover browser...");
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
