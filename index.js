import AWS from 'aws-sdk';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AMAZON_ACCESS_KEY,
  secretAccessKey: process.env.AMAZON_SECRET_ACCESS_KEY,
  region: process.env.AMAZON_REGION,
});

const BUCKET_NAME = process.env.AMAZON_BUCKET_NAME;
const INPUT_FOLDER = path.join(path.resolve(), "input");
const OUTPUT_FOLDER = path.join(path.resolve(), "output");

// Ensure directories exist
[INPUT_FOLDER, OUTPUT_FOLDER].forEach(folder => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  }
});

// Function to generate a new key for renamed images
const generateRenamedKey = (originalKey) => {
  return `${originalKey}-backup`;
};

// Function to download an image from S3
const downloadFromS3 = (key) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    };
    s3.getObject(params, (err, data) => {
      if (err) reject(err);
      else resolve({ key, buffer: data.Body });
    });
  });
};

// Function to upload an image to S3
const uploadToS3 = (key, buffer) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
    };
    s3.upload(params, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
};

// Function to remove background from an image
const removeBackground = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    execFile("rembg", ["i", inputPath, outputPath], (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
};

// Function to batch upload images to S3
const uploadBatchToS3 = (uploads) => {
  return Promise.all(
    uploads.map(({ key, buffer }) =>
      uploadToS3(key, buffer).catch(err => {
        console.error(`Failed to upload ${key}:`, err);
        throw err;
      })
    )
  );
};

// Main function to process images in bulk
const processImagesInBulk = async (imageKeys) => {
  try {
    const processedImages = [];

    // Step 1: Download all images from S3
    console.log("Downloading images...");
    const downloadPromises = imageKeys.map(key => downloadFromS3(key));
    const images = await Promise.all(downloadPromises);

    // Prepare upload data
    const renamedUploads = [];
    const processedUploads = [];

    // Step 2: Save images locally, process them, and prepare them for upload
    for (let i = 0; i < images.length; i++) {
      const { key, buffer } = images[i];

      // Rename and save the input image
      const renamedKey = generateRenamedKey(key);
      const inputPath = path.join(INPUT_FOLDER, `${path.basename(renamedKey)}.png`);
      const outputPath = path.join(OUTPUT_FOLDER, `${path.basename(key)}.png`);

      // Save the downloaded image locally with a new name
      fs.writeFileSync(inputPath, buffer);
      console.log(`Saved renamed input image locally: ${inputPath}`);

      // Remove background
      console.log(`Removing background for: ${inputPath}`);
      await removeBackground(inputPath, outputPath);

      // Prepare upload for processed image
      const processedBuffer = fs.readFileSync(outputPath);
      processedUploads.push({ key, buffer: processedBuffer });

      // Prepare upload for renamed input image
      renamedUploads.push({ key: renamedKey, buffer });

      processedImages.push({ originalKey: key, newInputKey: renamedKey });
    }

    // Step 3: Upload images in batch
    console.log("Uploading renamed input images in batch...");
    await uploadBatchToS3(renamedUploads);

    console.log("Uploading processed images in batch...");
    await uploadBatchToS3(processedUploads);

    console.log("All images processed and uploaded successfully.");
    return processedImages;
  } catch (error) {
    console.error("Error processing images in bulk:", error);
    throw error;
  }
};

// Set up Express app
const app = express();
app.use(express.json());

// API endpoint for bulk image processing
app.post('/process-images', async (req, res) => {
  const { imageKeys } = req.body; // Expecting an array of image keys

  if (!Array.isArray(imageKeys) || imageKeys.length === 0) {
    return res.status(400).json({ error: "An array of image keys is required." });
  }

  try {
    const result = await processImagesInBulk(imageKeys);
    res.json({ message: "Images processed successfully.", result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
