const fs = require("fs");
const path = require("path");

const BASE_DIR = "C:\\DuaReports";
const LOGS_DIR = path.join(BASE_DIR, "logs");

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Log file name per day
const logFilePath = path.join(LOGS_DIR, `${new Date().toISOString().slice(0, 10)}.log`);

function writeLog(level, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

  // Write to file
  fs.appendFileSync(logFilePath, line, "utf8");

  // Also output to console
  console.log(line.trim());
}

module.exports = {
  info: (msg) => writeLog("info", msg),
  warn: (msg) => writeLog("warn", msg),
  error: (msg) => writeLog("error", msg),
  debug: (msg) => writeLog("debug", msg),
};
