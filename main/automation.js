// const configManager = require('./config-manager');
// const path = require('path');
// const fs = require('fs');

// let busy = false; // Prevent overlapping runs

// const automationDir = path.join(__dirname, '../data/reports');
// if (!fs.existsSync(automationDir)) fs.mkdirSync(automationDir, { recursive: true });

// /**
//  * This function will start your automation.
//  * Right now it just logs config and user inputs.
//  * Later you can integrate Puppeteer scripts and action sheet execution here.
//  */
// const start = async () => {
//   if (busy) return;
//   busy = true;

//   try {
//     const config = configManager.getConfig();
//     const userInputs = configManager.getUserInputs();

//     if (!config || !config.user_id || !config.host) {
//       console.log('Config not found. Cannot start automation.');
//       busy = false;
//       return;
//     }

//     console.log('Automation started...');
//     console.log('Config:', config);
//     console.log('User Inputs:', userInputs);

//     // TODO: Load action sheets from local folder and execute
//     const actionSheetsDir = path.join(__dirname, '../action-sheets');
//     const actionSheets = fs.existsSync(actionSheetsDir)
//       ? fs.readdirSync(actionSheetsDir).map(file => path.join(actionSheetsDir, file))
//       : [];

//     for (const sheetPath of actionSheets) {
//       try {
//         const actionSheet = require(sheetPath);
//         console.log(`Executing action sheet: ${sheetPath}`);
//         // TODO: call your Puppeteer functions here with actionSheet
//       } catch (err) {
//         console.error('Error loading action sheet:', sheetPath, err);
//       }
//     }

//     console.log('Automation cycle complete.');
//   } catch (err) {
//     console.error('Error during automation:', err);
//   }

//   busy = false;
// };

// // Export start() so main/index.js can call it
// module.exports = {
//   start,
// };

// const path = require('path');
// const fs = require('fs');
// const puppeteer = require('puppeteer');
// const superagent = require('superagent');
// const FormData = require('form-data');
// const cronParser = require('cron-parser');
// const { parse, format } = require('date-fns');

// const configManager = require('./config-manager');

// const reportsDir = path.join(__dirname, '../data/reports');
// if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

// let busy = false;
// let alreadyRan = {}; // Track last run for cron expressions
// let userInputStore = {};

// const refreshUserInputs = async () => {
//   userInputStore = configManager.getUserInputs();
// };

// // ------------------ Helper Functions ------------------ //

// function sleep(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }

// function getUserInput(actionSheetId, token) {
//   if (userInputStore && userInputStore[actionSheetId] && userInputStore[actionSheetId].inputs) {
//     return userInputStore[actionSheetId].inputs[token] || '';
//   }
//   return '';
// }

// function generateDateForToken(token) {
//   // Very simple implementation, expand as needed
//   const today = new Date();
//   if (token === 'today') return format(today, 'dd/MM/yyyy');
//   if (token === 'yesterday') return format(new Date(today.setDate(today.getDate() - 1)), 'dd/MM/yyyy');
//   return '';
// }

// // ------------------ File Upload ------------------ //

// async function uploadReport(filePath, config) {
//   try {
//     const form = new FormData();
//     form.append('file', fs.createReadStream(filePath));

//     const uploadUrl = config.host + config.endpoints.report_upload.replace('{{userId}}', config.user_id);
//     const response = await superagent.post(uploadUrl).attach('file', fs.createReadStream(filePath));
//     console.log('Uploaded report:', filePath);
//   } catch (err) {
//     console.error('Upload failed:', err.message);
//   }
// }

// // ------------------ Puppeteer Automation ------------------ //

// async function executeActionSheet(actionSheet, actionSheetId, config) {
//   const browser = await puppeteer.launch({
//     executablePath: './chrome/chrome.exe',
//     headless: actionSheet?.headless !== 0,
//     defaultViewport: null,
//   });

//   const page = await browser.newPage();
//   await page.setCacheEnabled(false);
//   await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.140 Safari/537.36');

//   let jumpToNextReport = false;

//   for (const key in actionSheet.actions) {
//     const action = actionSheet.actions[key];

//     if (jumpToNextReport && action.type !== 'report-breakpoint') continue;

//     try {
//       if (action.log?.info) console.log(action.log.info);

//       // Random delay 1-2 sec
//       await sleep(Math.random() * 1000 + 1000);

//       switch (action.type) {
//         case 'launch':
//           await page.goto(action.site, { waitUntil: 'networkidle2' });
//           break;

//         case 'login':
//           for (const field of action.fields) {
//             const value = field.useUserInput ? getUserInput(actionSheetId, field.inputToken) : field.value;
//             await page.waitForSelector(field.selector, { timeout: 60000 });
//             await page.type(field.selector, value);
//           }
//           await page.click(action.submit.selector);
//           break;

//         case 'navigation':
//           await page.waitForSelector(action.selector, { timeout: action.customSelectorTimeout || 60000 });
//           if (action.waitBeforeInteraction) await sleep(action.waitBeforeInteraction);

//           // Handle file download
//           if (action.initiatesDownload) {
//             const client = await page.target().createCDPSession();
//             await client.send('Browser.setDownloadBehavior', {
//               behavior: 'allowAndName',
//               downloadPath: reportsDir,
//               eventsEnabled: true,
//             });
//           }

//           await page.click(action.selector);

//           // TODO: wait and rename downloaded file if needed
//           break;

//         case 'input':
//           await page.waitForSelector(action.selector, { timeout: action.customSelectorTimeout || 60000 });
//           if (action.waitBeforeInteraction) await sleep(action.waitBeforeInteraction);

//           let inputValue = action.useUserInput ? getUserInput(actionSheetId, action.inputToken) : action.value;
//           if (inputValue.includes('{{')) inputValue = generateDateForToken(inputValue.replace('{{', '').replace('}}', ''));

//           if (action.interaction === 'keyinput') await page.type(action.selector, inputValue);
//           if (action.interaction === 'select') await page.select(action.selector, inputValue);
//           break;

//         case 'close':
//           await browser.close();
//           break;
//       }
//     } catch (err) {
//       console.error('Action execution failed:', err);
//       jumpToNextReport = true;
//     }
//   }

//   await browser.close();
// }

// // ------------------ Main Automation Loop ------------------ //

// const start = async () => {
//   if (busy) return;
//   busy = true;
//   console.log('Automation cycle started...');
//   const config = configManager.getConfig();
//   if (!config || !config.user_id || !config.host) {
//     console.log('No valid config. Automation will not run.');
//     busy = false;
//     return;
//   }

//   console.log('Current Config:', config);
//   await refreshUserInputs();

//   const actionSheetsDir = path.join(__dirname, '../action-sheets');
//   const sheets = fs.existsSync(actionSheetsDir)
//     ? fs.readdirSync(actionSheetsDir).map(f => path.join(actionSheetsDir, f))
//     : [];

//   console.log('Action Sheets Found:', sheets);

//   const now = new Date();
//   for (const sheetPath of sheets) {
//     try {
//       const sheet = require(sheetPath);

//       // Check cron runtimes
//       console.log('Checking runtimes for sheet:', sheet.id);
//       let shouldRun = false;
//       for (const rtKey in sheet.config?.runtimes || {}) {
//         try {
//           const interval = cronParser.parseExpression(sheet.config.runtimes[rtKey], { currentDate: new Date(now.getTime() - 1000) });
//           const next = interval.next().toDate();
//           if (Math.abs(next.getTime() - now.getTime()) < 1000 && (!alreadyRan[sheet.id] || alreadyRan[sheet.id].getTime() !== next.getTime())) {
//             shouldRun = true;
//             alreadyRan[sheet.id] = next;
//             break;
//           }
//         } catch {}
//       }

//       if (shouldRun) {
//         console.log('Executing action sheet:', sheetPath);
//         await executeActionSheet(sheet, sheet.id, config);
//       }
//     } catch (err) {
//       console.error('Failed to load action sheet:', sheetPath, err);
//     }
//   }

//   busy = false;
// };

// module.exports = { start };

// ---- puppeteer automation.js ---- //

const fs = require("fs");
const path = require("path");
// const puppeteer = require("puppeteer");
const puppeteer = require("puppeteer-core");
const { TimeoutError } = require("puppeteer");
const FormData = require("form-data");
const superagent = require("superagent");
const cronParser = require("cron-parser");
const CronExpressionParser =
  cronParser.CronExpressionParser || cronParser.default;
const forget = require("require-and-forget");
const { parse, format } = require("date-fns");

// Set Chrome executable path for Windows
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
console.log("Chrome executable path:", chromePath);

const PROJECT_DIR = path.resolve(__dirname, "..");
console.log("Project dir:", PROJECT_DIR);

// Electron app path
const { app } = require("electron");
const PROPER_DIRNAME = path.join(PROJECT_DIR, "userData");

if (!fs.existsSync(PROPER_DIRNAME)) {
  fs.mkdirSync(PROPER_DIRNAME, { recursive: true });
}

const configFilePath = path.join(PROPER_DIRNAME, "config.json");
const userInputFilePath = path.join(PROPER_DIRNAME, "user-input.json");
const actionSheetsDir = path.join(PROPER_DIRNAME, "action-sheets");

console.log("Config file path:", configFilePath);
console.log("Action sheets dir:", actionSheetsDir);
console.log("User input file path:", userInputFilePath);

// Ensure action-sheets folder exists
if (!fs.existsSync(actionSheetsDir))
  fs.mkdirSync(actionSheetsDir, { recursive: true });

// --------------------
// Utility Functions
// --------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// --------------------
// User Input Store
// --------------------
let userInputStore = {};
const refreshUserInput = async () => {
  try {
    if (fs.existsSync(userInputFilePath)) {
      userInputStore = JSON.parse(fs.readFileSync(userInputFilePath, "utf8"));
    }
  } catch (err) {
    console.error("Error reading user input file", err);
  }
};

const getUserInput = (sheetId, token) => {
  return userInputStore?.[sheetId]?.inputs?.[token] || null;
};

// --------------------
// Puppeteer & ActionSheet Executor
// --------------------
const reportDownloadDir = path.join(PROPER_DIRNAME, "reports");

if (!fs.existsSync(reportDownloadDir))
  fs.mkdirSync(reportDownloadDir, { recursive: true });

async function waitUntilDownload(session, downloadPath = "", fileName = "") {
  return new Promise((resolve, reject) => {
    const guids = {};
    session.on("Browser.downloadWillBegin", (event) => {
      guids[event.guid] = fileName + event.suggestedFilename;
    });
    session.on("Browser.downloadProgress", (e) => {
      if (e.state === "completed") {
        try {
          fs.renameSync(
            path.resolve(downloadPath, e.guid),
            path.resolve(downloadPath, guids[e.guid])
          );
        } catch (err) {
          console.error(err);
        }
        resolve(path.resolve(downloadPath, guids[e.guid]));
      } else if (e.state === "canceled") reject(new Error("Download canceled"));
    });
  });
}

const initiateProcess = async (sheetId, actionSheet, configuration) => {
  let browser;
  let page;

  try {
    // Launch Puppeteer

    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: false,
      defaultViewport: null,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    page = await browser.newPage();
    console.log("Browser and page initialized");

    await page.setCacheEnabled(false);
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/116.0.5845.140 Safari/537.36"
    );

    // Process each action
    for (const key in actionSheet.actions) {
      const action = actionSheet.actions[key];
      console.log("\nAction raw object:", action);
      console.log("Processing action:", action.type);

      try {
        // Wait 1-2 seconds before each action
        await sleep(Math.floor(Math.random() * 1000) + 1000);
        console.log(`Executing action: ${action.type}`);

        switch (action.type) {
          case "launch":
            console.log("Launching site:", action.site);
            try {
              await page.goto(action.site, {
                waitUntil: "networkidle2",
                timeout: 60000,
              });
              console.log("Navigation complete:", action.site);
            } catch (err) {
              console.error("Navigation failed:", err.message);
            }
            break;

          case "wait":
            console.log(`Waiting for ${action.duration}ms...`);
            await sleep(action.duration);
            break;

          case "login":
            console.log("Starting login action...");
            console.log("Fields to fill:", action.fields);
            console.log("Submit action:", action.submit);

            if (!action.fields || action.fields.length === 0) {
              console.warn("No fields defined for login.");
            }

            for (const field of action.fields) {
              console.log(`Processing field selector: ${field.selector}`);
              await page.waitForSelector(field.selector, { timeout: 60000 });
              const value = field.useUserInput
                ? getUserInput(sheetId, field.inputToken)
                : field.value;
              console.log(`Typing into ${field.selector}: ${value}`);
              await page.type(field.selector, value);
            }

            if (action.submit && action.submit.selector) {
              console.log("Submit selector found:", action.submit.selector);
              try {
                await page.waitForSelector(action.submit.selector, {
                  timeout: 60000,
                });
                console.log("Submit selector is visible, clicking now...");
                await page.click(action.submit.selector);
                console.log("Clicked submit button.");
              } catch (err) {
                console.error(
                  "Submit selector not found or not clickable:",
                  err.message
                );
              }
            } else {
              console.warn("Submit action not defined or missing selector.");
            }

            // Optionally wait after submitting
            if (action.waitAfterSubmit) {
              console.log(
                `Waiting ${action.waitAfterSubmit}ms after submit...`
              );
              await page.waitForTimeout(action.waitAfterSubmit);
            }
            break;

          case "navigation":
            await page.waitForSelector(action.selector, { timeout: 60000 });
            if (action.waitBeforeInteraction)
              await sleep(action.waitBeforeInteraction);
            await page.click(action.selector);

            if (action.initiatesDownload) {
              const client = await page.target().createCDPSession();
              await client.send("Browser.setDownloadBehavior", {
                behavior: "allowAndName",
                downloadPath: reportDownloadDir,
                eventsEnabled: true,
              });
              const prefix = action.filePrefix || "report";
              const finalFilePath = await waitUntilDownload(
                client,
                reportDownloadDir,
                Date.now() + "-" + prefix + "-"
              );

              // Upload the downloaded file
              try {
                await superagent
                  .post(
                    configuration.host +
                      configuration.endpoints.report_upload.replace(
                        "{{userId}}",
                        configuration.user_id
                      )
                  )
                  .attach("file", fs.createReadStream(finalFilePath));
                console.log("Report uploaded:", finalFilePath);
              } catch (err) {
                console.error("Upload error:", err.message);
              }
            }
            break;

          case "close":
            console.log("Closing browser...");
            break;

          default:
            console.warn("Unknown action type:", action.type);
        }
      } catch (err) {
        console.error("Error executing action:", action.type, err.message);
      }
    }
  } catch (err) {
    console.error("Error initializing Puppeteer:", err.message);
  } finally {
    if (browser) {
      await browser.close();
      console.log("Browser closed");
    }
  }
};

// --------------------
// Main Automation Loop
// --------------------
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

const downloadFileAs = async (url, savePath) => {
  const file = fs.createWriteStream(savePath);
  const protocol = url.startsWith("https") ? require("https") : require("http");
  return new Promise((resolve, reject) => {
    protocol
      .get(url, (res) => {
        res.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", reject);
  });
};

async function main() {
  if (busy) return;
  busy = true;

  try {
    console.log("Checking configuration...");

    if (!fs.existsSync(configFilePath)) {
      console.log("Configuration file not found at", configFilePath);
      busy = false;
      return;
    }

    configuration = JSON.parse(fs.readFileSync(configFilePath, "utf8"));
    // console.log("Loaded configuration:", JSON.stringify(configuration, null, 2));

    // Refresh user input
    await refreshUserInput();

    // Iterate action sheets
    for (const sheet of configuration.action_sheets || []) {
      const sheetPath = path.join(actionSheetsDir, sheet.name + ".json");
      console.log("Checking action sheet:", sheet.name);

      if (!fs.existsSync(sheetPath)) {
        console.log(`Action sheet file not found at ${sheetPath}`);
        continue;
      }

      const actionSheet = forget(sheetPath);

      console.log("Sheet object:", JSON.stringify(sheet, null, 2));
      // console.log("Sheet config:", JSON.stringify(sheet.config, null, 2));
      // console.log("Runtimes:", JSON.stringify(sheet.config?.runtimes || {}, null, 2));

      let shouldRun = false;
      const now = new Date();

      for (const cronExpr of Object.values(sheet.config?.runtimes || {})) {
        try {
          console.log(`Evaluating cron expression: ${cronExpr}`);

          // Use CronExpressionParser.parse for cron-parser >=5.x
          const interval = CronExpressionParser.parse(cronExpr, {
            currentDate: new Date(now.getTime() - 1000),
          });
          const next = interval.next().toDate();

          console.log(
            `Cron schedule for ${
              sheet.name
            }: next run at ${next.toISOString()}, now is ${now.toISOString()}`
          );

          if (
            Math.abs(next.getTime() - now.getTime()) < 60000 &&
            (!alreadyRan[sheet.id] ||
              alreadyRan[sheet.id].getTime() !== next.getTime())
          ) {
            console.log(`Action sheet ${sheet.name} is scheduled to run now.`);
            shouldRun = true;
            alreadyRan[sheet.id] = next;
            break;
          } else {
            console.log(`Action sheet ${sheet.name} is not due yet.`);
          }
        } catch (err) {
          console.error(`Cron error in ${sheet.name}:`, err.message);
        }
      }

      if (shouldRun) {
        console.log(`Running action sheet ${sheet.name}...`);
        await initiateProcess(sheet.id, actionSheet, configuration);
        console.log(`Finished running action sheet ${sheet.name}.`);
      } else {
        console.log(`Skipping action sheet ${sheet.name}.`);
      }
    }
  } catch (err) {
    console.error("Automation main loop error:", err);
  }

  busy = false;
}

// Start loop every 2 seconds
function start() {
  console.log("Automation started...");
  setInterval(main, 20000);
}

module.exports = { start };
