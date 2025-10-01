const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const logger = require("./logger");

// Paths
const CONFIG_DIR = path.join("C:", "DuaReports", "config");
const EXCEL_FILE = path.join(CONFIG_DIR, "user-input.xlsx");
const JSON_FILE = path.join(CONFIG_DIR, "user-input.json");

function generateUserJson() {
  try {
    if (!fs.existsSync(EXCEL_FILE)) {
      logger.warn(`Excel file not found at path: ${EXCEL_FILE}`);
      return;
    }

    logger.info(`Reading Excel file from: ${EXCEL_FILE}`);
    const workbook = xlsx.readFile(EXCEL_FILE);

    logger.info(`Sheets found in workbook: ${workbook.SheetNames.join(", ")}`);
    const jsonOutput = {};

    workbook.SheetNames.forEach(sheetName => {
      logger.info(`Processing sheet: "${sheetName}"`);

      const sheet = workbook.Sheets[sheetName];

      // Convert sheet to JSON, fill empty cells with ""
      const sheetData = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false });
      logger.info(`Rows read from sheet "${sheetName}": ${sheetData.length}`);

      if (sheetData.length === 0) {
        logger.warn(`Sheet "${sheetName}" is empty. Skipping.`);
        return;
      }

      logger.info("First row example:", sheetData[0]);

      // Filter rows with all required fields
      const validRows = sheetData.filter(
        row => row.Dealer && row.Location && row.ID && row.Password
      );

      if (validRows.length === 0) {
        logger.warn(`No valid rows found in sheet "${sheetName}". Check column names.`);
      }

      // Map to required JSON format
      jsonOutput["test-sheet"] = { // Force key as "test-sheet"
        inputs: validRows.map(row => ({
          Dealer_name: row.Dealer,
          Location: row.Location,
          userId: row.ID,
          password: row.Password
        }))
      };

      logger.info(`Rows included in JSON from sheet "${sheetName}": ${validRows.length}`);
    });

    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

    fs.writeFileSync(JSON_FILE, JSON.stringify(jsonOutput, null, 2));
    logger.info(`User input JSON successfully generated at: ${JSON_FILE}`);
  } catch (err) {
    logger.error("Error generating user JSON:", err);
  }
}

module.exports = { generateUserJson };

