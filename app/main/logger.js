const fs = require("fs");
const path = require("path");

const BASE_DIR = "C:\\DuaReports";
const LOGS_DIR = path.join(BASE_DIR, "logs");

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Log file name per day
const logFilePath = path.join(LOGS_DIR, `${new Date().toISOString().slice(0, 10)}.log`);

function writeLog(level, ...messages) {
  const timestamp = new Date().toISOString();
  const line =
    `[${timestamp}] [${level.toUpperCase()}] ` +
    messages
      .map((m) =>
        typeof m === "object" ? JSON.stringify(m, null, 2) : String(m)
      )
      .join(" ") +
    "\n";

  fs.appendFileSync(logFilePath, line, "utf8");
  console.log(line.trim());
}


module.exports = {
  info: (...msgs) => writeLog("info", ...msgs),
  warn: (...msgs) => writeLog("warn", ...msgs),
  error: (...msgs) => writeLog("error", ...msgs),
  debug: (...msgs) => writeLog("debug", ...msgs),
};