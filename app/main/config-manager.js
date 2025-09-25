const fs = require('fs');
const path = require('path');

// Use the global dua-data folder (created by installer)
const BASE_DIR = "C:\\dua-data";
// const BASE_DIR = process.env.DUA_DATA_PATH || "C:\\dua-data";

const configFilePath = path.join(BASE_DIR, 'config', 'config.json');
const userInputFilePath = path.join(BASE_DIR, 'config', 'user-input.json');

console.log('Config file path:', configFilePath);
console.log('User input file path:', userInputFilePath);

function appendActionSheet(sheet) {
  const config = getConfig();

  if (!Array.isArray(config.action_sheets)) {
    config.action_sheets = [];
  }

  // Prevent duplicates based on sheet ID
  const existingIds = new Set(config.action_sheets.map(s => s.id));
  if (!existingIds.has(sheet.id)) {
    config.action_sheets.push(sheet);
    saveConfig(config);
    console.log(`Action sheet appended: ${sheet.name}`);
  } else {
    console.log(`Action sheet already exists: ${sheet.name}`);
  }

  return config;
}

// Ensure files exist
function ensureFile(filePath, defaultData = {}) {
  console.log(`Ensuring file exists: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    console.log(`File does not exist. Creating: ${filePath}`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    console.log(`File created with default data: ${JSON.stringify(defaultData)}`);
  } else {
    console.log(`File already exists: ${filePath}`);
  }
}

// CONFIG FUNCTIONS
function getConfig() {
  console.log('Getting config from:', configFilePath);
  ensureFile(configFilePath, {});
  try {
    const data = fs.readFileSync(configFilePath, 'utf8');
    console.log('Config file data:', data);
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading config.json:', err);
    return {};
  }
}

function saveConfig(newConfig) {
  console.log('Saving new config:', newConfig);
  console.log('Config file path:', configFilePath);
  ensureFile(configFilePath, {});
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2));
    console.log('Config saved successfully.');
    return true;
  } catch (err) {
    console.error('Error writing config.json:', err);
    return false;
  }
}

// USER INPUT FUNCTIONS
function getUserInputs() {
  console.log('Getting user inputs from:', userInputFilePath);
  ensureFile(userInputFilePath, {});
  try {
    const data = fs.readFileSync(userInputFilePath, 'utf8');
    console.log('User input file data:', data);
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading user-input.json:', err);
    return {};
  }
}

function saveUserInputs(newInputs) {
  console.log('Saving new user inputs:', newInputs);
  console.log('User input file path:', userInputFilePath);
  ensureFile(userInputFilePath, {});
  try {
    fs.writeFileSync(userInputFilePath, JSON.stringify(newInputs, null, 2));
    console.log('User inputs saved successfully.');
    return true;
  } catch (err) {
    console.error('Error writing user-input.json:', err);
    return false;
  }
}

module.exports = {
  getConfig,
  saveConfig,
  getUserInputs,
  saveUserInputs,
  appendActionSheet
};
