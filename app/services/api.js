// api.js
const superagent = require("superagent");

const API_BASE_URL = ""; 

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


// api.js
const axios = require("axios");

const API_BASE = "https://testhost.com"; // change to your backend

async function fetchConfig(userId) {
  try {
    const res = await axios.get(`${API_BASE}/config/${userId}`);
    return res.data;
  } catch (err) {
    console.error("❌ Error fetching config:", err.message);
    return null;
  }
}

async function uploadReport(userId, reportData) {
  try {
    const res = await axios.post(`${API_BASE}/report/upload/${userId}`, reportData);
    return res.data;
  } catch (err) {
    console.error("❌ Error uploading report:", err.message);
    return null;
  }
}

async function fetchSheets(userId) {
  try {
    const res = await axios.get(`${API_BASE}/sheets/${userId}`);
    return res.data; // could be list of sheet metadata
  } catch (err) {
    console.error("❌ Error fetching sheets:", err.message);
    return [];
  }
}

module.exports = {
  fetchConfig,
  fetchSheets,
  uploadReport,
};

