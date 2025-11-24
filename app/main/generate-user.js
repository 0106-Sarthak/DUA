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
    const jsonOutput = {};

    workbook.SheetNames.forEach(sheetName => {
      logger.info(`Processing sheet: "${sheetName}"`);

      const sheet = workbook.Sheets[sheetName];
      const sheetData = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false });

      if (sheetData.length === 0) {
        logger.warn(`Sheet "${sheetName}" is empty. Skipping.`);
        return;
      }

      const validRows = sheetData.filter(
        row => row.Dealer && row.ID && row.Password && row["Active Postion"] && row.Reports
      );

      // Group by Dealer, ID, Password
      const groupedData = {};

      validRows.forEach(row => {
        const key = `${row.Dealer}_${row.ID}_${row.Password}`;
        if (!groupedData[key]) {
          groupedData[key] = {
            dealerName: row.Dealer,
            userId: row.ID,
            password: row.Password,
            activePositions: [],
            runSheets: []
          };
        }

        groupedData[key].activePositions.push(row["Active Postion"]);

        if (row.Reports) {
          const nums = row.Reports
            .toString()
            .split(",")
            .map(n => parseInt(n.trim(), 10))
            .filter(n => !isNaN(n));

            if (!nums.includes(0)) {
              nums.unshift(0);
            }

          groupedData[key].runSheets = nums;
        }
      });

      jsonOutput["test-sheet"] = {
        inputs: Object.values(groupedData)
      };

      logger.info(`Processed ${Object.keys(groupedData).length} dealer entries from "${sheetName}"`);
    });

    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(JSON_FILE, JSON.stringify(jsonOutput, null, 2));
    logger.info(`✅ User input JSON successfully generated at: ${JSON_FILE}`);
  } catch (err) {
    logger.error("Error generating user JSON:", err);
  }
}

module.exports = { generateUserJson };
