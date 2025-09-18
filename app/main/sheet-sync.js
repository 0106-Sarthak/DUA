// sheet-sync.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { getLatestSheetLinks } = require('../services/db');

async function downloadFile(url, dest) {
  const file = fs.createWriteStream(dest);
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function run() {
  try {
    console.log("Executing sheet sync :- ");
    const latestSheet = await getLatestSheetLinks();
    if (!latestSheet) {
      console.log("No sheet found in database.");
      return;
    }

    console.log("Latest sheet data:", latestSheet);
    const { id, action_sheet_url, url: site_url } = latestSheet;
    console.log(`Found latest sheet: ${id}`);

    const sheetsDir = path.join(__dirname, '..', 'userData', 'action-sheets');
    console.log("Sheets Directory:", sheetsDir);
    if (!fs.existsSync(sheetsDir)) {
      fs.mkdirSync(sheetsDir, { recursive: true });
    }

    const filePath = path.join(sheetsDir, `${id}.json`);
    console.log(`Downloading file from ${action_sheet_url}`);
    await downloadFile(action_sheet_url, filePath);
    console.log("Download complete.");

    // Read the downloaded file and update it
    const content = fs.readFileSync(filePath, 'utf8');
    console.log("content", content);
    let json;
    try {
      json = JSON.parse(content);
    } catch (err) {
      console.error("Error parsing JSON:", err.message);
      return;
    }

    // Update site URLs in the actions if necessary
    let updated = false;
    if (json.actions) {
      for (const key in json.actions) {
        const action = json.actions[key];
        if (action.type === 'launch' && action.site !== site_url) {
          console.log(`Updating site URL in action ${key}`);
          action.site = site_url;
          updated = true;
        }
      }
    }

    if (updated) {
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
      console.log("Action sheet updated with new site URLs.");
    } else {
      console.log("No updates needed for site URLs.");
    }
  } catch (err) {
    console.error("Error in process:", err.message);
  }
}

module.exports = {
  run
};
