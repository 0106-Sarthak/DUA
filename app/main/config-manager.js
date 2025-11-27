const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const defaultConfig = {
  user_id: "testuser",
  host: "https://testhost.com",
  endpoints: {
    config: "/config/{{userId}}",
    report_upload: "/report/upload/{{userId}}"
  },
  action_sheets: [
    { id: "test-sheet", name: "sheet-1", config: { runtimes: { every_hour: "* * * * *" } } },
    { id: "changePosition", name: "changePosition", number: 0, multi_position: true, config: { runtimes: { every_hour: "* * * * *" } } },
    { id: "lineItems", name: "lineItems", number: 1, multi_position: true, config: { runtimes: { every_hour: "* * * * *" } } },
    { id: "MISSpares", name: "MISSpares", number: 2, multi_position: true, config: { runtimes: { every_hour: "* * * * *" } } },
    { id: "OTCSales", name: "OTCSales", number: 3, multi_position: true, config: { runtimes: { every_hour: "* * * * *" } } },
    { id: "ChannelPartnerPurchase", name: "ChannelPartnerPurchase", number: 4, multi_position: true, config: { runtimes: { every_hour: "* * * * *" } } },
    { id: "JobCardInvoice", name: "JobCardInvoice", number: 5, multi_position: true, config: { runtimes: { every_hour: "* * * * *" } } },
    { id: "allServiceInvoice", name: "allServiceInvoice", number: 6, multi_position: true, config: { runtimes: { every_hour: "* * * * *" } } },
    { id: "sheet-3", name: "sheet-3", config: { runtimes: { every_hour: "* * * * *" } } }
  ]
};

const BASE_DIR = "C:\\DuaReports";
const CONFIG_DIR = path.join(BASE_DIR, "config");
const REPORTS_DIR = path.join(BASE_DIR, "reports");

const configFilePath = path.join(CONFIG_DIR, "config.json");
const userInputFilePath = path.join(CONFIG_DIR, "user-input.json");

logger.info("Config file path:", configFilePath);
logger.info("User input file path:", userInputFilePath);

function ensureDirs() {
  [BASE_DIR, CONFIG_DIR, REPORTS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

ensureDirs();

function appendActionSheet(sheet) {
  const config = getConfig();

  if (!Array.isArray(config.action_sheets)) {
    config.action_sheets = [];
  }

  // Prevent duplicates based on sheet ID
  const existingIds = new Set(config.action_sheets.map((s) => s.id));
  if (!existingIds.has(sheet.id)) {
    config.action_sheets.push(sheet);
    saveConfig(config);
    logger.info(`Action sheet appended: ${sheet.name}`);
  } else {
    logger.info(`Action sheet already exists: ${sheet.name}`);
  }

  return config;
}

// Ensure files exist
function ensureFile(filePath, defaultData = {}) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  } else {
    logger.info(`File already exists: ${filePath}`);
  }
}

// CONFIG FUNCTIONS
// function getConfig() {
//   logger.info("Getting config from:", configFilePath);
//   ensureFile(configFilePath, {});
//   try {
//     const data = fs.readFileSync(configFilePath, "utf8");
//     logger.debug("Config file data:", data);
//     return JSON.parse(data);
//   } catch (err) {
//     logger.error("Error reading config.json:", err);
//     return {};
//   }
// }

function getConfig() {
  logger.info("Getting config from:", configFilePath);

  // If config file missing -> write default config (do not overwrite existing)
  if (!fs.existsSync(configFilePath)) {
    try {
      fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
      fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 2));
      logger.info("Default config created at:", configFilePath);
      return JSON.parse(JSON.stringify(defaultConfig));
    } catch (err) {
      logger.error("Error creating default config:", err);
      return {};
    }
  }

  // If exists, read and return (catch parse errors)
  try {
    const data = fs.readFileSync(configFilePath, "utf8");
    logger.debug("Config file data:", data);
    return JSON.parse(data || "{}");
  } catch (err) {
    logger.error("Error reading config.json (will recreate default):", err);
    // If corrupted, recreate default (safer than leaving broken file)
    try {
      fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 2));
      logger.info("Recreated default config due to read error.");
      return JSON.parse(JSON.stringify(defaultConfig));
    } catch (err2) {
      logger.error("Failed to recreate default config:", err2);
      return {};
    }
  }
}

function saveConfig(newConfig) {
  logger.info("Saving new config:", newConfig);
  logger.info("Config file path:", configFilePath);
  ensureFile(configFilePath, {});
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2));
    logger.info("Config saved successfully.");
    return true;
  } catch (err) {
    logger.error("Error writing config.json:", err);
    return false;
  }
}

// USER INPUT FUNCTIONS
function getUserInputs() {
  logger.info("Getting user inputs from:", userInputFilePath);
  ensureFile(userInputFilePath, {});
  try {
    const data = fs.readFileSync(userInputFilePath, "utf8");
    logger.debug("User input file data:", data);
    return JSON.parse(data);
  } catch (err) {
    logger.error("Error reading user-input.json:", err);
    return {};
  }
}

function saveUserInputs(newInputs) {
  logger.info("Saving new user inputs:", newInputs);
  logger.info("User input file path:", userInputFilePath);
  ensureFile(userInputFilePath, {});
  try {
    fs.writeFileSync(userInputFilePath, JSON.stringify(newInputs, null, 2));
    logger.info("User inputs saved successfully.");
    return true;
  } catch (err) {
    logger.error("Error writing user-input.json:", err);
    return false;
  }
}

let currentRunInputs = {};

function setCurrentRunInputs(sheetId, creds) {
  currentRunInputs[sheetId] = creds;
}

function getUserInput(sheetId, token) {
  const creds = currentRunInputs[sheetId];
  if (!creds) {
    logger.warn(`No current credentials found for sheet: ${sheetId}`);
    return null;
  }
  return creds[token] || null;
}

function getCurrentRunInputs(sheetId) {
  return currentRunInputs[sheetId] || null;
}

module.exports = {
  getConfig,
  saveConfig,
  getUserInputs,
  saveUserInputs,
  appendActionSheet,
  setCurrentRunInputs,
  getUserInput,
  getCurrentRunInputs,
};
