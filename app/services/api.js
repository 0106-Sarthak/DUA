// api.js
const fs = require('fs');
const path = require('path');

const superagent = require("superagent");

const BASE_DIR = "C:\\dua-data";
const actionSheetsDir = path.join(BASE_DIR, "sheets");

const FormData = require("form-data");

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


const axios = require("axios");

async function sendFile(filePath) {
  console.log("Starting upload:", filePath);

  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));

  try {
    const res = await axios.post("http://localhost:4000/util/upload", form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 20000   // 20 sec timeout
    });
    
    console.log("Upload finished:", filePath);
  } catch (err) {
    console.error("Upload failed:", filePath, err.message);
  }
}


async function uploadAllFilesInFolder(folderPath) {
  try {
    const files = fs.readdirSync(folderPath);

    if (files.length === 0) {
      console.log("No files found in folder:", folderPath);
      return;
    }

    console.log(`Uploading ${files.length} files from folder: ${folderPath}`);

    for (const file of files) {
      const fullPath = path.join(folderPath, file);

      // Skip directories
      if (fs.lstatSync(fullPath).isDirectory()) {
        console.log("Skipping directory:", file);
        continue;
      }

      console.log("Uploading file:", fullPath);
      await sendFile(fullPath); // upload function
    }

    console.log("All files uploaded.");

  } catch (err) {
    console.error("Error uploading folder files:", err);
  }
}


module.exports = { fetchRemoteSheets, uploadAllFilesInFolder};
