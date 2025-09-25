const sql = require("mssql");

const dbConfig = {
  user: "sa",
  password: "HazazUh5zusWaVIrad",
  server: "10.10.152.18",
  database: "DUA_App",
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

async function getConnection() {
  try {
    const pool = await sql.connect(dbConfig);
    return pool;
  } catch (err) {
    console.error("Database connection failed:", err);
    throw err;
  }
}

module.exports = { sql, getConnection };
