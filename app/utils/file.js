const fs = require('fs-extra');
const path = require('path');

const readJSON = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading JSON from ${filePath}:`, err);
    return null;
  }
};

const writeJSON = (filePath, data) => {
  try {
    fs.ensureFileSync(filePath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error(`Error writing JSON to ${filePath}:`, err);
    return false;
  }
};

module.exports = {
  readJSON,
  writeJSON
};
