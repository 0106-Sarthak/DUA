const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const BASE_DIR = "C:\\DuaReports";
const CONFIG_DIR = path.join(BASE_DIR, "config");
const REPORTS_DIR = path.join(BASE_DIR, "reports");

const configFilePath = path.join(CONFIG_DIR, "config.json");
const userInputFilePath = path.join(CONFIG_DIR, "user-input.json");

logger.info("Config file path:", configFilePath);
logger.info("User input file path:", userInputFilePath);

function ensureDirs() {
  [BASE_DIR, CONFIG_DIR, REPORTS_DIR].forEach(dir => {
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
function getConfig() {
  logger.info("Getting config from:", configFilePath);
  ensureFile(configFilePath, {});
  try {
    const data = fs.readFileSync(configFilePath, "utf8");
    logger.debug("Config file data:", data);
    return JSON.parse(data);
  } catch (err) {
    logger.error("Error reading config.json:", err);
    return {};
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

let currentRunInputs = {}; // stores the creds for the current automation run

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
