const path = require("path");

// Base directory for all app data
const BASE_DIR = "C:\\DuaReports";

// Subdirectories
const CONFIG_DIR = path.join(BASE_DIR, "config");
const REPORTS_DIR = path.join(BASE_DIR, "reports");
const ACTION_SHEETS_DIR = path.join(BASE_DIR, "sheets");
const LOGS_DIR = path.join(BASE_DIR, "logs");

// Files
const CONFIG_FILE_PATH = path.join(CONFIG_DIR, "config.json");
const USER_INPUT_FILE_PATH = path.join(CONFIG_DIR, "user-input.json");

// Export constants
module.exports = {
  BASE_DIR,
  CONFIG_DIR,
  REPORTS_DIR,
  ACTION_SHEETS_DIR,
  LOGS_DIR,
  CONFIG_FILE_PATH,
  USER_INPUT_FILE_PATH,
  reportDownloadDir: REPORTS_DIR,
};
