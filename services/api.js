// api.js
const superagent = require("superagent");

const API_BASE_URL = "https://your-api.com"; // Replace with your actual API base URL

async function fetchActionSheet(sheetId) {
  try {
    const response = await superagent.get(`${API_BASE_URL}/action-sheets/${sheetId}`);
    return response.body;
  } catch (error) {
    console.error(`Error fetching action sheet ${sheetId}:`, error.message);
    throw error;
  }
}

async function uploadReport(userId, filePath, config) {
  try {
    const url = `${config.host}${config.endpoints.report_upload.replace("{{userId}}", userId)}`;
    const response = await superagent
      .post(url)
      .attach("file", require("fs").createReadStream(filePath));
    return response.body;
  } catch (error) {
    console.error("Error uploading report:", error.message);
    throw error;
  }
}

// You can add more API functions here as needed

module.exports = {
  fetchActionSheet,
  uploadReport,
};
