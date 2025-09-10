const fs = require('fs');
const path = require('path');

// Define file paths
const PROPER_DIRNAME = path.join(__dirname, '..');
const configFilePath = path.join(PROPER_DIRNAME, 'config', 'config.json');
const userInputFilePath = path.join(PROPER_DIRNAME, 'config', 'user-input.json');

// Ensure files exist
function ensureFile(filePath, defaultData = {}) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

// CONFIG FUNCTIONS
function getConfig() {
  ensureFile(configFilePath, {});
  try {
    const data = fs.readFileSync(configFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading config.json:', err);
    return {};
  }
}

function saveConfig(newConfig) {
  ensureFile(configFilePath, {});
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2));
    return true;
  } catch (err) {
    console.error('Error writing config.json:', err);
    return false;
  }
}

// USER INPUT FUNCTIONS
function getUserInputs() {
  ensureFile(userInputFilePath, {});
  try {
    const data = fs.readFileSync(userInputFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading user-input.json:', err);
    return {};
  }
}

function saveUserInputs(newInputs) {
  ensureFile(userInputFilePath, {});
  try {
    fs.writeFileSync(userInputFilePath, JSON.stringify(newInputs, null, 2));
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
  saveUserInputs
};
