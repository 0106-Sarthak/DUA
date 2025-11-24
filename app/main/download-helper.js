const fs = require("fs");
const path = require("path");
const logger = require("./logger");

// --- Main function ---
async function waitUntilDownload(
  session,
  downloadPath = "",
  fileName = "",
  creds = {}
) {
  return new Promise((resolve, reject) => {
    const guids = {};

    // Log when a download begins
    session.on("Browser.downloadWillBegin", (event) => {
      guids[event.guid] = fileName + event.suggestedFilename;
    });

    // Track download progress
    session.on("Browser.downloadProgress", (e) => {
      // Try reading directory contents for debugging
      try {
        const files = fs.readdirSync(downloadPath);
      } catch (err) {
        logger.warn(`[DOWNLOAD DEBUG] Could not list download dir: ${err.message}`);
      }

      if (e.state === "completed") {
        try {
          // Extract dealer & activePosition safely
          const dealerRaw = creds.Dealer_name || creds.dealerName || "";
          const positionRaw = creds.activePosition || "";

          // Sanitize for folder names
          const dealerSafe = dealerRaw
            .toString()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "_");
          const positionSafe = positionRaw
            .toString()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "_");

          // Build directory path
          let targetDir = downloadPath;
          if (dealerSafe) targetDir = path.join(targetDir, dealerSafe);
          if (positionSafe) targetDir = path.join(targetDir, positionSafe);

          fs.mkdirSync(targetDir, { recursive: true });

          // Possible file names (Chrome may use GUID or suggestedFilename)
          const guidPath = path.resolve(downloadPath, e.guid);
          const suggestedPath = path.resolve(downloadPath, guids[e.guid]);
          let sourcePath = null;

          if (fs.existsSync(guidPath)) {
            sourcePath = guidPath;
            
          } else if (fs.existsSync(suggestedPath)) {
            sourcePath = suggestedPath;
            
          } else {
            logger.error(`[DOWNLOAD ERROR] File not found for GUID=${e.guid}`);
            return reject(new Error("Download completed but file not found"));
          }

          const destPath = path.resolve(targetDir, guids[e.guid]);
          logger.info(`[DOWNLOAD MOVE] Moving file to: ${destPath}`);

          fs.renameSync(sourcePath, destPath);
          

          resolve(destPath);
        } catch (err) {
          logger.error(`[DOWNLOAD ERROR] ${err.stack}`);
          reject(err);
        }
      } else if (e.state === "canceled") {
        logger.warn(`[DOWNLOAD CANCELED] GUID=${e.guid}`);
        reject(new Error("Download canceled"));
      }
    });
  });
}

// --- Exports ---
module.exports = {
  waitUntilDownload,
};
