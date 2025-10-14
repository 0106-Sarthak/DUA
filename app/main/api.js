import multer from "multer";
import path from "path";
import { Upload } from "@aws-sdk/lib-storage";
import { S3Client } from "@aws-sdk/client-s3";
import fs from "fs/promises";

// -------------------- MULTER CONFIG --------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

// CSV file filter
const fileFilterCsv = (req, file, cb) => {
  const allowedExtensions = [".csv"];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed!"), false);
  }
};

// Multer instance for CSV upload
const uploadCsv = multer({
  storage: storage,
  fileFilter: fileFilterCsv,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// -------------------- AWS CONFIG --------------------
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// -------------------- UPLOAD TO S3 --------------------
const uploadToS3 = async (file, dealerName, locationName) => {
  if (!dealerName || !locationName) {
    throw new Error("dealerName and locationName are required");
  }

  const fileStream = await fs.readFile(file.path);

  // Clean and sanitize folder names (optional but recommended)
  const safeDealer = dealerName.replace(/[^a-zA-Z0-9-_]/g, "_");
  const safeLocation = locationName.replace(/[^a-zA-Z0-9-_]/g, "_");

  // Define S3 key (path inside bucket)
  const key = `${safeDealer}/${safeLocation}/${file.filename}`;

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: fileStream,
      ContentType: file.mimetype,
    },
  });

  const result = await upload.done();

  // Delete local file after upload
  await fs.unlink(file.path);

  return {
    url: result.Location,
    key,
  };
};

export { uploadCsv, uploadToS3 };

// usage in an Express route 
import express from "express";
import { uploadCsv, uploadToS3 } from "./upload.js";

const router = express.Router();

router.post("/upload-csv", uploadCsv.single("file"), async (req, res) => {
  try {
    const { dealerName, locationName } = req.body; // sent in request body or query

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const result = await uploadToS3(req.file, dealerName, locationName);
    res.json({ message: "Upload successful", ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

