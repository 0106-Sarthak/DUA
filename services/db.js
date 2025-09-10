const sql = require("mssql");

const config = {
  user: "sa",
  password: "HazazUh5zusWaVIrad",
  server: "10.10.152.18", // e.g., 'localhost' or '192.168.1.10'
  database: "DUA",
  options: {
    encrypt: true, // Use true if you're connecting to Azure SQL
    trustServerCertificate: true, // Change to false in production
  },
};

async function getLatestSheetLinks() {
  try {
    await sql.connect(config);
    console.log("Connection Established to DB -> ", config);
    const result = await sql.query`
      select u.id,ip.portal_id,ip.action_sheet_url,i.url from  Users u
      inner join integrated_portal_reports ip 
      on u.id=ip.id 
      inner join integrated_portals i on ip.portal_id=i.id
      where u.id=3
    `;
    console.log(result);
    return result.recordset.length ? result.recordset[0] : null;
  } catch (err) {
    console.error("Database error:", err.message);
    throw err;
  } finally {
    await sql.close();
  }
}

module.exports = {
  getLatestSheetLinks,
};
