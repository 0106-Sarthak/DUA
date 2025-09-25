// // dummy-server.js
// const express = require("express");
// const app = express();
// app.use(express.json());
// const {getConnection , dbConfig} = require("./db");


// async function createUser() {
//   const pool = await getConnection();
//   const result = await pool.request()
//     .query("INSERT INTO Users DEFAULT VALUES; SELECT SCOPE_IDENTITY() as userId;");
//   console.log("New User ID:", result.recordset[0].userId);
// }

// app.post("/verify-key", (req, res) => {
//   const { key } = req.body;

//   if (key === "12345") {
//     return res.json({
//       success: true,
//       user_id: "testuser",
//       dealer_name: "Test Dealer",
//       message: "Key verified successfully!"
//     });
//   }

//   return res.status(401).json({
//     success: false,
//     message: "Invalid key"
//   });
// });

// app.get("/sheets/:userId", (req, res) => {
//   const { userId } = req.params;

//   // Dummy sheets for this user
//   const sheets = [
//     {
//       id: "sheet-1",
//       name: "sheet-1",
//       downloadUrl: "https://example.com/sheets/sheet-1.js",
//       config: { runtimes: { every_minute: "* * * * *" } }
//     },
//     {
//       id: "sheet-2",
//       name: "sheet-2",
//       downloadUrl: "https://example.com/sheets/sheet-2.js",
//       config: { runtimes: { every_minute: "* * * * *" } }
//     }
//   ];

//   res.json({ success: true, sheets });
// });

// app.listen(4000, () => console.log("Dummy API running on http://localhost:4000"));
