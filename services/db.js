// db.js
const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'HazazUh5zusWaVIrad',
  server: '10.10.152.18', // e.g., 'localhost' or '192.168.1.10'
  database: 'DUA',
  options: {
    encrypt: true, // Use true if you're connecting to Azure SQL
    trustServerCertificate: true // Change to false in production
  }
};

async function getLatestSheetLinks() {
  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT TOP 1 id, file_url FROM action_sheets ORDER BY updated_at DESC
    `;
    return result.recordset.length ? result.recordset[0] : null;
  } catch (err) {
    console.error('Database error:', err.message);
    throw err;
  } finally {
    await sql.close();
  }
}

module.exports = {
  getLatestSheetLinks,
};
