// ---- puppeteer automation.js ---- //

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
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

const BASE_DIR = process.env.DUA_DATA_PATH || "C:\\dua-data";
console.log("Project dir:", BASE_DIR);

// Electron app path
const { app } = require("electron");
const appPath = app.getAppPath();

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

[ path.dirname(configFilePath), logsDir, reportsDir, actionSheetsDir ].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

console.log("Config file path:", configFilePath);
console.log("User input file path:", userInputFilePath);
console.log("Action sheets dir:", actionSheetsDir);
console.log("Logs dir:", logsDir);
console.log("Reports dir:", reportsDir);

// Ensure action-sheets folder exists
if (!fs.existsSync(actionSheetsDir))
  fs.mkdirSync(actionSheetsDir, { recursive: true });

// --------------------
// Utility Functions
// --------------------


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
const reportDownloadDir = path.join(BASE_DIR, "reports");

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

// Main function to execute action sheet
const initiateProcess = async (sheetId, actionSheet, configuration) => {
  let browser;
  let page;

  try {
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    page = await browser.newPage();

    // Listen for dialog popups like 'beforeunload'
    page.on('dialog', async dialog => {
      console.log(`Dialog appeared: ${dialog.message()}`);

      if (dialog.type() === 'beforeunload') {
        console.log("Handling 'beforeunload' dialog: leaving the page...");
        await dialog.accept(); // Automatically click "Leave"
      } else {
        console.log(`Handling ${dialog.type()} dialog: dismissing`);
        await dialog.dismiss(); // Ignore other dialogs
      }
    });

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
        // Wait for a visible body as a generic delay
        await page.waitForSelector("body", { visible: true, timeout: 60000 });
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
              // Attempt a reload
              try {
                console.log("Attempting to reload the page...");
                await page.reload({ waitUntil: "networkidle2", timeout: 60000 });
                console.log("Reload successful");
              } catch (reloadErr) {
                console.error("Reload failed:", reloadErr.message);
              }
            }
            break;

          case "wait":
            console.log(`Waiting for ${action.duration}ms...`);
            // // Wait for a visible body as a generic delay
            // await page.waitForSelector("body", {
            //   visible: true,
            //   timeout: Math.max(action.duration, 1000),
            // });
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
              console.log(`Waiting after submit...`);
              await page.waitForSelector("body", {
                visible: true,
                timeout: Math.max(action.waitAfterSubmit, 1000),
              });
            }
            break;

          case "navigation":
            await page.waitForSelector(action.selector, { timeout: 60000 });
            if (action.waitBeforeInteraction)
              await page.waitForSelector("body", {
                visible: true,
                timeout: Math.max(action.waitBeforeInteraction, 1000),
              });
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

          case "click":
            console.log(
              "Executing click:",
              action.description || action.selector
            );

            if (action.selector.startsWith("//")) {
              action.selector = action.selector.replace("{{searchText}}", action.searchText);
              console.log(`Waiting for XPath: ${action.selector}`);
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

                await page.evaluate((searchText) => {
                  const links = Array.from(
                    document.querySelectorAll("a")
                  ).filter((a) => a.textContent.includes(`${searchText}`));

                  if (links.length === 0) {
                    console.error(`No links found containing '${searchText}'`);
                    return;
                  }
                  console.log(
                    `Found ${links.length} link(s) containing '${searchText}'.`
                  );

                  links.forEach((link, index) => {
                    console.log(`Checking link ${index + 1}:`, link.outerHTML);

                    const onclickCode = link.getAttribute("onclick");
                    if (onclickCode) {
                      console.log(
                        `Executing onclick on link ${index + 1}:`,
                        onclickCode
                      );
                      if (onclickCode.trim().startsWith("return")) {
                        const code = onclickCode.replace(/^return\s+/, "");
                        console.log(`Executing onclick after removing 'return':`, code);
                        eval(code);
                      } else {
                        console.log(`Executing onclick as is:`, onclickCode);
                        eval(onclickCode);
                      }
                    } else {
                      const link = Array.from(document.querySelectorAll("a"))
                        .find(a => a.textContent.trim() === "" + searchText + "");

                      const eventOptions = { bubbles: true, cancelable: true, view: window };
                      link.dispatchEvent(new MouseEvent("mouseover", eventOptions));
                      link.dispatchEvent(new MouseEvent("mousedown", eventOptions));
                      link.dispatchEvent(new MouseEvent("mouseup", eventOptions));
                      link.dispatchEvent(new MouseEvent("click", eventOptions));
                      console.log("Click executed.");
                    }
                  });
                }, action.searchText);
              } catch (err) {
                console.error("Error waiting for XPath:", err.message);
              }
            } else {
              // CSS selector path
              console.log(`Waiting for selector: ${action.selector}`);

              try {
                await page.waitForSelector(action.selector, {
                  visible: true,
                  timeout: 60000,
                });
                console.log(
                  "Selector found, scrolling into view.",
                  action.selector
                );
                
                await page.evaluate((selector) => {
                  const el = document.querySelector(selector);
                  if (el) el.scrollIntoView({ block: "center" });
                }, action.selector);

                console.log("Triggering native click event.");
                await page.click(action.selector);

                console.log("Click executed, waiting for navigation.");

                // flag to determine the download behavior
                if (action.initiatesDownload) {
                  console.log("Setting up download behavior...");

                  const client = await page.createCDPSession();
                  await client.send("Browser.setDownloadBehavior", {
                    behavior: "allowAndName",
                    downloadPath: reportDownloadDir,
                    eventsEnabled: true,
                  });

                  const prefix = action.filePrefix || "";
                  const readableDate = format(new Date(), "yyyyMMdd_HHmmss");
                  const finalFilePath = await waitUntilDownload(
                    client,
                    reportDownloadDir,
                    readableDate + "-" + prefix + "-"
                  );

                  console.log("Download completed:", finalFilePath);
                  // Clean up session after download
                  await client.detach();
                }
              } catch (err) {
                console.error(
                  "Error clicking element for selector:",
                  err.message
                );
              }
            }
            break;

          case "keyboard" :
            console.log(
              "Executing keyboard action:",
              action.description || action.key
            );
            if (action.key) {
              await page.keyboard.press(action.key, { delay: 100 });
              console.log(`Pressed key: ${action.key}`);
            }
            break;

          case "type":
            console.log(
              "Executing type:",
              action.description || action.selector
            );
            await page.waitForSelector(action.selector, {
              visible: true,
              timeout: 60000,
            });
            await page.type(action.selector, action.value, { delay: 100 });
            console.log("Typing completed.");
            break;

          case "upload":
            const inputUploadHandle = await page.$(action.selector);
            if (inputUploadHandle) {
              await inputUploadHandle.uploadFile(action.filePath);
              console.log(`Uploaded file: ${action.filePath}`);
            } else {
              console.log(`Could not find upload input: ${action.selector}`);
            }
            break;

          case "select":
            try {
              await page.select(action.selector, action.value);
              console.log(`✅ Selected value '${action.value}' for ${action.selector}`);
            } catch (err) {
              console.error(`❌ Failed to select '${action.value}' for ${action.selector}:`, err);
            }
            break;

          case "logout":
            console.log("Executing logout");

            if (!action.steps || !Array.isArray(action.steps)) {
              console.error("Logout steps not defined or invalid.");
              break;
            }

            for (const step of action.steps) {
              console.log(
                `Waiting for: ${step.description} (${step.selector})`
              );
              await page.waitForSelector(step.selector, {
                visible: true,
                timeout: 60000,
              });
              console.log(`Found ${step.description}, clicking...`);
              await page.click(step.selector);
            }

            console.log("Logout action completed.");
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
    console.log("Loaded configuration:", JSON.stringify(configuration, null, 2));

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
  setInterval(main, 2000);
}

module.exports = { start };
