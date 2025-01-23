import AWS from 'aws-sdk';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import express from 'express';
import dotenv from 'dotenv';


dotenv.config();


// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AMAZON_ACCESS_KEY,
  secretAccessKey: process.env.AMAZON_SECRET_ACCESS_KEY,
  region:process.env.AMAZON_REGION,
});

const BUCKET_NAME = process.env.AMAZON_BUCKET_NAME;
const LOCAL_FOLDER = path.join(path.resolve(), "output");
console.log(BUCKET_NAME)
// Ensure the output directory exists
if (!fs.existsSync(LOCAL_FOLDER)) {
  fs.mkdirSync(LOCAL_FOLDER);
}

// Function to download the image from S3
const downloadFromS3 = (key) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    };
    s3.getObject(params, (err, data) => {
      if (err) reject(err);
      else resolve(data.Body);
    });
  });
};

// Function to upload image to S3
const uploadToS3 = (key, buffer) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,  // You can modify the key if you want to change the filename on S3
      Body: buffer,
      ContentType: "image/png",
    };
    s3.upload(params, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
};

// Function to remove background using rembg
const removeBackground = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    execFile("rembg", ["i", inputPath, outputPath], (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
};

// Main function
const processImage = async (imageKey) => {
  try {
    console.log(`Downloading image: ${imageKey}`);

    // Step 1: Download image from S3
    const imageBuffer = await downloadFromS3(imageKey);
    const inputPath = path.join(LOCAL_FOLDER, "input.png");
    const outputPath = path.join(LOCAL_FOLDER, "output.png");

    // Step 2: Save image to a local file
    fs.writeFileSync(inputPath, imageBuffer);
    console.log(`Image saved locally at ${inputPath}`);

    // Step 3: Remove background
    console.log(`Removing background for ${inputPath}`);
    await removeBackground(inputPath, outputPath);

    // Step 4: Upload the processed image back to S3
    const outputBuffer = fs.readFileSync(outputPath);
    console.log(`Uploading processed image to S3 with key: ${imageKey}`);
    await uploadToS3(imageKey, outputBuffer); // Uploading back to the same key

    console.log(`Background removed and image uploaded to S3.`);
    return `https://${BUCKET_NAME}.s3.amazonaws.com/${imageKey}`; // URL to the uploaded image
  } catch (error) {
    console.error("Error processing image:", error);
    throw error;
  }
};

// Set up Express app
const app = express();
app.use(express.json());

// API endpoint
app.post('/process-image', async (req, res) => {
  const imageKey = "product-1723456189240"; // Example key

  if (!imageKey) {
    return res.status(400).json({ error: "Image key is required." });
  }

  try {
    const imageUrl = await processImage(imageKey);
    res.json({ message: "Image processed and uploaded to S3 successfully.", imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
