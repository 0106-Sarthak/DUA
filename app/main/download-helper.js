const fs = require("fs");
const path = require("path");
const { logger } = require("./logger"); 

// --- Helpers ---

function sanitizeName(name = "") {
  return name.toString().replace(/\s+/g, "_");
}

function buildDownloadPath(downloadPath, creds) {
  const dealerSafe = sanitizeName(creds.Dealer_name || creds.dealerName);
  const locationSafe = sanitizeName(creds.Location || creds.location);

  let targetDir = downloadPath;
  if (dealerSafe) targetDir = path.join(targetDir, dealerSafe);
  if (locationSafe) targetDir = path.join(targetDir, locationSafe);

  fs.mkdirSync(targetDir, { recursive: true });
  return targetDir;
}

function moveDownloadedFile(sessionGuid, guids, downloadPath, targetDir) {
  const sourcePath = path.resolve(downloadPath, sessionGuid);
  const destPath = path.resolve(targetDir, guids[sessionGuid]);
  fs.renameSync(sourcePath, destPath);
  return destPath;
}

// --- Main function ---

async function waitUntilDownload(session, downloadPath = "", fileName = "", creds = {}) {
  return new Promise((resolve, reject) => {
    const guids = {};

    session.on("Browser.downloadWillBegin", (event) => {
      guids[event.guid] = fileName + event.suggestedFilename;
    });

    session.on("Browser.downloadProgress", (e) => {
      if (e.state === "completed") {
        try {
          const targetDir = buildDownloadPath(downloadPath, creds);
          const destPath = moveDownloadedFile(e.guid, guids, downloadPath, targetDir);
          logger.info("Download moved to:", destPath);
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
  buildDownloadPath,
  moveDownloadedFile,
  sanitizeName,
};
