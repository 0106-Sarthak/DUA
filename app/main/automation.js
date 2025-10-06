const fs = require("fs");
const path = require("path");
const cronParser = require("cron-parser");
const CronExpressionParser =
  cronParser.CronExpressionParser || cronParser.default;
const forget = require("require-and-forget");
const configManager = require("./config-manager");
// const logger = require("./logger");
const { runWorkflow } = require("./automation/workflow");

const { launchBrowser } = require("./automation/browser");

// Set Chrome executable path for Windows
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
console.log("Chrome executable path:", chromePath);

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
  console.log("Created BASE_DIR:", BASE_DIR);
}

const configFilePath = path.join(BASE_DIR, "config", "config.json");
const userInputFilePath = path.join(BASE_DIR, "config", "user-input.json");
const actionSheetsDir = path.join(BASE_DIR, "sheets");
const logsDir = path.join(BASE_DIR, "logs");
const reportsDir = path.join(BASE_DIR, "reports");

[CONFIG_DIR, REPORTS_DIR, ACTION_SHEETS_DIR, LOGS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log("Created directory:", dir);
  }
});

console.log("Config file path:", configFilePath);
console.log("User input file path:", userInputFilePath);
console.log("Action sheets dir:", actionSheetsDir);
console.log("Logs dir:", logsDir);
console.log("Reports dir:", reportsDir);

// Ensure action-sheets folder exists
if (!fs.existsSync(actionSheetsDir)) {
  fs.mkdirSync(actionSheetsDir, { recursive: true });
  console.log("Created actionSheetsDir:", actionSheetsDir);
}

// Utility Functions

const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

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
      console.log("Refreshed userInputStore:", userInputStore);
    }
  } catch (err) {
    // console.error("Error reading user input file", err);
    console.error("Error reading user input file", err);
  }
};

// Puppeteer & ActionSheet Executor
const reportDownloadDir = path.join(BASE_DIR, "reports");

if (!fs.existsSync(reportDownloadDir)) {
  fs.mkdirSync(reportDownloadDir, { recursive: true });
  console.log("Created reportDownloadDir:", reportDownloadDir);
}

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

// async function main() {
//   if (busy) {
//     console.log("Main loop is busy, skipping this run.");
//     return;
//   }
//   busy = true;

//   try {
//     console.log("Checking configuration...");

//     if (!fs.existsSync(configFilePath)) {
//       console.log("Configuration file not found at", configFilePath);
//       busy = false;
//       return;
//     }

//     configuration = JSON.parse(fs.readFileSync(configFilePath, "utf8"));
//     console.log("Loaded configuration:", configuration);

//     // Refresh user inputs
//     await refreshUserInput();

//     console.log("Launching shared browser for all sheets...");
//     const { browser, page } = await launchBrowser();

//     // Iterate action sheets
//     for (const sheet of configuration.action_sheets || []) {
//       const sheetPath = path.join(actionSheetsDir, sheet.name + ".json");
//       console.log("Checking action sheet:", sheet.name);

//       if (!fs.existsSync(sheetPath)) {
//         console.log(`Action sheet file not found at ${sheetPath}`);
//         continue;
//       }

//       const actionSheet = forget(sheetPath);

//       console.log("Sheet object:", sheet);

//       // Check if this sheet is scheduled to run now
//       let shouldRun = false;
//       const now = new Date();

//       for (const cronExpr of Object.values(sheet.config?.runtimes || {})) {
//         try {
//           const interval = CronExpressionParser.parse(cronExpr, {
//             currentDate: new Date(now.getTime() - 1000),
//           });
//           const next = interval.next().toDate();

//           console.log(
//             `Cron schedule for ${
//               sheet.name
//             }: next run at ${next.toISOString()}, now is ${now.toISOString()}`
//           );

//           if (
//             Math.abs(next.getTime() - now.getTime()) < 60000 &&
//             (!alreadyRan[sheet.id] ||
//               alreadyRan[sheet.id].getTime() !== next.getTime())
//           ) {
//             console.log(`Action sheet ${sheet.name} is scheduled to run now.`);
//             shouldRun = true;
//             alreadyRan[sheet.id] = next;
//             break;
//           }
//         } catch (err) {
//           console.error(`Cron error in ${sheet.name}:`, err.message);
//         }
//       }

//       if (!shouldRun) {
//         console.log(`Skipping action sheet ${sheet.name}.`);
//         continue;
//       }

//       // Run the sheet for each user
//       const credsArray = userInputStore[sheet.id]?.inputs || [];
//       if (credsArray.length === 0) {
//         console.log(`No user inputs found for sheet ${sheet.name}, skipping.`);
//         continue;
//       }

//       for (const creds of credsArray) {
//         console.log(`Running sheet ${sheet.name} for user ${creds.userId}`);
//         // Set current run inputs so actions can access them
//         configManager.setCurrentRunInputs(sheet.id, creds);

//         try {
//           // const loginSucceeded = await initiateProcess(
//           //   sheet.id,
//           //   actionSheet,
//           //   configuration
//           // );
//           const loginSucceeded = await runWorkflow(
//             sheet.id,
//             actionSheet,
//             configuration,
//             page
//           );
//           console.log(
//             `runWorkflow result for user ${creds.userId}:`,
//             loginSucceeded
//           );
//           if (!loginSucceeded) {
//             console.log(
//               `Login failed for user ${creds.userId}, skipping remaining actions.`
//             );
//             continue; // skip this user
//           }
//           console.log(
//             `Finished running sheet ${sheet.name} for user ${creds.userId}`
//           );
//         } catch (err) {
//           console.error(
//             `Error running sheet ${sheet.name} for user ${creds.userId}:`,
//             err.message
//           );
//         }
//       }
//     }
//   } finally {
//     if (browser) {
//       console.log("Closing shared browser after all sheets done...");
//       await browser.close();
//     }
//   }

//   busy = false;
// }

async function main() {
  if (busy) {
    console.log("Main loop is busy, skipping this run.");
    return;
  }
  busy = true;

  let browser; // declare outside try so we can close it finally

  try {
    console.log("Checking configuration...");

    if (!fs.existsSync(configFilePath)) {
      console.log("Configuration file not found at", configFilePath);
      busy = false;
      return;
    }

    configuration = JSON.parse(fs.readFileSync(configFilePath, "utf8"));
    console.log("Loaded configuration:", configuration);

    // Refresh user inputs
    await refreshUserInput();

    // ---- 🔁 NEW LOOP STRUCTURE ----
    // Extract all unique users across all sheets
    const allUsers = {};

    for (const [sheetId, sheetData] of Object.entries(userInputStore)) {
      for (const creds of sheetData.inputs || []) {
        const key = creds.userId || creds.username;
        if (!allUsers[key]) allUsers[key] = creds;
      }
    }

    // For each user -> open browser once -> run all sheets
    for (const [userKey, creds] of Object.entries(allUsers)) {
      console.log(`\n=== Starting all sheets for user: ${userKey} ===`);

      const { browser: userBrowser, page } = await launchBrowser();
      browser = userBrowser; // assign so we can close later if crash happens

      for (const sheet of configuration.action_sheets || []) {
        const sheetPath = path.join(actionSheetsDir, sheet.name + ".json");
        if (!fs.existsSync(sheetPath)) {
          console.log(`Action sheet not found: ${sheetPath}`);
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
            console.log(
              `❌ Sheet ${sheet.name} failed for ${userKey}, skipping to next sheet.`
            );
            break;
          }
          console.log(`✅ Finished sheet ${sheet.name} for ${userKey}`);
        } catch (err) {
          console.error(
            `Error in sheet ${sheet.name} for ${userKey}:`,
            err.message
          );
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
