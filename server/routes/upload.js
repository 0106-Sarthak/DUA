// const express = require("express");
// const router = express.Router();
// const multer = require("multer");
// const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
// require("dotenv").config();

// // Multer storage (memory storage keeps file in RAM, no temp saving)
// const upload = multer({ storage: multer.memoryStorage() });

// const s3 = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
//   }
// });

// router.post("/", upload.single("file"), async (req, res) => {
//   try {
//     if (!req.file) return res.status(400).json({ error: "No file uploaded" });

//     const params = {
//       Bucket: process.env.AWS_BUCKET,
//       Key: `reports/${Date.now()}_${req.file.originalname}`,
//       Body: req.file.buffer,
//       ContentType: req.file.mimetype
//     };

//     await s3.send(new PutObjectCommand(params));

//     res.json({
//       success: true,
//       message: "Uploaded to S3 successfully",
//       file: params.Key
//     });

//   } catch (err) {
//     console.error("S3 Upload Error:", err);
//     res.status(500).json({ error: "Upload failed", details: err.message });
//   }
// });

// module.exports = router;

const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Use memory storage so files are not written to disk
const upload = multer({ storage: multer.memoryStorage() });

// router.post("/upload", upload.single("file"), async (req, res) => {
//   try {
//     if (!req.file) {
//       console.log("No file received");
//       return res.status(400).json({ error: "No file uploaded" });
//     }

//     console.log("File received:");
//     console.log("Original Name:", req.file.originalname);
//     console.log("Mime Type:", req.file.mimetype);
//     console.log("Size:", req.file.size, "bytes");

//     // If filename contains folder path (Windows)
//     console.log("Full multer file object:", req.file);

//     const BASE_SAVE_DIR = path.join(__dirname, "downloaded");

//     fs.mkdirSync(path.dirname(BASE_SAVE_DIR), { recursive: true });

//     // Save file buffer to disk
//     fs.writeFileSync(BASE_SAVE_DIR, req.file.buffer);

//     console.log("Saved at:", BASE_SAVE_DIR);

//     // Send response
//     res.json({
//       success: true,
//       message: "File received successfully",
//       fileName: req.file.originalname,
//       size: req.file.size
//     });

//     // save the file in local 

//   } catch (err) {
//     console.error("Error processing file:", err);
//     res.status(500).json({ error: "Processing failed" });
//   }
// });

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("File received:", req.file.originalname);

    // Base folder where all uploads go
    const SAVE_DIR = path.join(__dirname, "downloaded");

    // Ensure folder exists
    fs.mkdirSync(SAVE_DIR, { recursive: true });

    // Full save path INCLUDING filename
    const savePath = path.join(SAVE_DIR, req.file.originalname);

    // Write the file buffer
    fs.writeFileSync(savePath, req.file.buffer);

    console.log("Saved at:", savePath);

    return res.json({
      success: true,
      message: "File saved successfully",
      fileName: req.file.originalname,
      savedPath: savePath
    });

  } catch (err) {
    console.error("Error processing file:", err);
    res.status(500).json({ error: "Processing failed" });
  }
});


module.exports = router;
