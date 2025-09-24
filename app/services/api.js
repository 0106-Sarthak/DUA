// api.js
const fs = require('fs');
const path = require('path');

const superagent = require("superagent");

const BASE_DIR = "C:\\dua-data";
const actionSheetsDir = path.join(BASE_DIR, "sheets");

async function fetchRemoteSheets(userId) {
  console.log("Fetching sheets for user:", userId);

  // Ensure action-sheets folder exists
  if (!fs.existsSync(actionSheetsDir)) {
    fs.mkdirSync(actionSheetsDir, { recursive: true });
  }

  // Dummy example data API will come here exposed on admin panel
  const sheets = [
    {
      id: "test-sheet",
      name: "sheet-2",
      downloadUrl: "https://audit-leads-docs.s3.ap-south-1.amazonaws.com/1757413201487_test-sheet.json",
      config: {
        runtimes: {
          every_minute: "* * * * *"
        }
      }
    }
  ];

  // Download each sheet
  for (const sheet of sheets) {
    try {
      const res = await fetch(sheet.downloadUrl);
      console.log(`Downloading sheet from: ${sheet.downloadUrl}`);
      if (!res.ok) throw new Error(`Failed to download ${sheet.name}`);
      const content = await res.text();

      const filePath = path.join(actionSheetsDir, sheet.name + path.extname(sheet.downloadUrl));
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`Downloaded sheet: ${sheet.name} → ${filePath}`);

      // Remove the downloadUrl from sheet metadata before appending
      delete sheet.downloadUrl;

    } catch (err) {
      console.error(`Error downloading sheet ${sheet.name}:`, err);
    }
  }

  return sheets;
}

module.exports = { fetchRemoteSheets };

