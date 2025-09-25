const { getConnection, sql } = require("../db");

// Add new action sheet for a user
exports.addSheet = async (req, res) => {
  const { userId, url } = req.body;

  if (!userId || !url) {
    return res.status(400).json({ success: false, message: "userId and url are required" });
  }

  try {
    const pool = await getConnection();
    await pool.request()
      .input("userId", sql.Int, userId)
      .input("url", sql.NVarChar, url)
      .query(`
        INSERT INTO ActionSheets (UserId, ActionSheetUrl) 
        VALUES (@userId, @url)
      `);

    res.json({ success: true, message: "Action sheet added successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all action sheets by userId
exports.getSheetsByUser = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId is required" });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT * FROM ActionSheets 
        WHERE UserId = @userId
      `);

    res.json({ success: true, sheets: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete an action sheet by its Id
exports.deleteSheet = async (req, res) => {
  const { sheetId } = req.params;

  if (!sheetId) {
    return res.status(400).json({ success: false, message: "sheetId is required" });
  }

  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("sheetId", sql.Int, sheetId)
      .query("DELETE FROM ActionSheets WHERE SheetId = @sheetId");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ success: false, message: "Sheet not found" });
    }

    res.json({ success: true, message: "Action sheet deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
