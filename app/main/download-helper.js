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

    session.on("Browser.downloadWillBegin", (event) => {
      guids[event.guid] = fileName + event.suggestedFilename;
    });

    session.on("Browser.downloadProgress", (e) => {
      if (e.state === "completed") {
        try {
          // Extract dealer & activePosition safely
          const dealerRaw = creds.Dealer_name || creds.dealerName || "";
          const positionRaw = creds.activePosition || "";

          // Sanitize for folder names
          const dealerSafe = dealerRaw.toString().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
          const positionSafe = positionRaw.toString().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");

          // Build directory path
          let targetDir = downloadPath;
          if (dealerSafe) targetDir = path.join(targetDir, dealerSafe);
          if (positionSafe) targetDir = path.join(targetDir, positionSafe);

          fs.mkdirSync(targetDir, { recursive: true });

          const sourcePath = path.resolve(downloadPath, e.guid);
          const destPath = path.resolve(targetDir, guids[e.guid]);

          logger.info(`Dealer: ${dealerSafe}`);
          logger.info(`Position: ${positionSafe}`);
          logger.info(`Target Directory: ${targetDir}`);

          fs.renameSync(sourcePath, destPath);
          logger.info("✅ Download moved to:", destPath);

          resolve(destPath);
        } catch (err) {
          reject(err);
        }
      } else if (e.state === "canceled") {
        reject(new Error("Download canceled"));
      }
    });
  });
}


// --- Exports ---

module.exports = {
  waitUntilDownload,
};
