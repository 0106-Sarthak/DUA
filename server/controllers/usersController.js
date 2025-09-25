const { getConnection, sql } = require("../db");


function generateSecretKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < 16; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Insert dashes to get xxxx-xxxx-xxxx-xxxx format
  return key.match(/.{1,4}/g).join("-");
}

// Create new user
exports.createUser = async (req, res) => {
  const { name, active = false } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: "Name is required" });
  }

  try {
    const secretKey = generateSecretKey();
    const pool = await getConnection();
    const result = await pool.request()
      .input("secretKey", sql.NVarChar, secretKey)
      .input("name", sql.NVarChar, name)
      .input("active", sql.Bit, active)
      .query(`
        INSERT INTO Users (SecretKey, Name, Active)
        VALUES (@secretKey, @name, @active);
        SELECT SCOPE_IDENTITY() as userId;
      `);

    res.json({ success: true, userId: result.recordset[0].userId, secretKey });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all users
exports.getUsers = async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query("SELECT * FROM Users");
    res.json({ success: true, users: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT * FROM Users WHERE UserId = @id");

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const pool = await getConnection();
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM Users WHERE UserId = @id");

    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


// Verify user key and activate user by secretKey only
exports.verifyUserKey = async (req, res) => {
  const { secretKey } = req.body;
  if (!secretKey) {
    return res.status(400).json({ success: false, message: "secretKey is required" });
  }

  try {
    const pool = await getConnection();

    // First, get the user by secretKey
    const userResult = await pool.request()
      .input("secretKey", sql.NVarChar, secretKey)
      .query("SELECT UserId, Name, Active FROM Users WHERE SecretKey = @secretKey");

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Invalid secretKey" });
    }

    const user = userResult.recordset[0];

    if (user.Active) {
      return res.json({
        success: true,
        user_id: user.UserId,
        dealer_name: user.Name,
        message: "User is already active",
        active: user.Active
      });
    }

    // Activate user
    await pool.request()
      .input("userId", sql.Int, user.UserId)
      .query("UPDATE Users SET Active = 1 WHERE UserId = @userId");

    res.json({
      success: true,
      user_id: user.UserId,
      dealer_name: user.Name,
      message: "User verified and activated",
      action: user.action
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Deactivate user by userId
exports.deactivateUser = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId is required" });
  }

  try {
    const pool = await getConnection();

    // Check if user exists
    const userCheck = await pool.request()
      .input("userId", sql.Int, userId)
      .query("SELECT UserId, Name, Active FROM Users WHERE UserId = @userId");

    if (userCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = userCheck.recordset[0];

    if (!user.Active) {
      return res.json({
        success: true,
        user_id: user.UserId,
        dealer_name: user.Name,
        message: "User is already inactive",
      });
    }

    // Deactivate user
    await pool.request()
      .input("userId", sql.Int, user.UserId)
      .query("UPDATE Users SET Active = 0 WHERE UserId = @userId");

    res.json({
      success: true,
      user_id: user.UserId,
      dealer_name: user.Name,
      message: "User deactivated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

