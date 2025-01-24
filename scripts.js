import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AMAZON_ACCESS_KEY,
  secretAccessKey: process.env.AMAZON_SECRET_ACCESS_KEY,
  region: process.env.AMAZON_REGION,
});

const BUCKET_NAME = process.env.DEV_AWS_BUCKET_NAME;
const DOWNLOAD_FOLDER = path.join(path.resolve(), 'download');

// Ensure the download folder exists
if (!fs.existsSync(DOWNLOAD_FOLDER)) {
  fs.mkdirSync(DOWNLOAD_FOLDER);
}

// Function to download an image from S3 and save it locally
const downloadAndSaveFromS3 = async (key) => {
  console.log(`Attempting to download key: ${key}`);
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    };

    s3.getObject(params, (err, data) => {
      if (err) {
        console.error(`Error downloading key "${key}": ${err.message}`);
        reject(err);
      } else {
        const filePath = path.join(DOWNLOAD_FOLDER, `${key.replace(/\//g, '_')}.png`); // Save as .png
        fs.writeFileSync(filePath, data.Body);
        console.log(`Image downloaded and saved: ${filePath}`);
        resolve(filePath);
      }
    });
  });
};
// Function to batch download images and save them locally
export const downloadImagesInBatch = async (imageKeys) => {
  const downloadedFiles = [];
  for (const key of imageKeys) {
    try {
      const filePath = await downloadAndSaveFromS3(key);
      downloadedFiles.push(filePath);
    } catch (err) {
      console.warn(`Skipping key "${key}" due to error: ${err.message}`);
    }
  }
  return downloadedFiles;
};

// Function to upload images in batch to S3
export const uploadBatchToAWS = async () => {
  const files = fs.readdirSync(DOWNLOAD_FOLDER);

  const uploadPromises = files.map((file) => {
    const filePath = path.join(DOWNLOAD_FOLDER, file);
    const fileStream = fs.createReadStream(filePath);

    const params = {
      Bucket: BUCKET_NAME,
      Key: file, // Use the file name as the key
      Body: fileStream,
    };

    return s3
      .upload(params)
      .promise()
      .then(() => {
        console.log(`Uploaded file: ${file}`);
        return file;
      })
      .catch((err) => {
        console.error(`Error uploading file "${file}": ${err.message}`);
        throw err;
      });
  });

  return Promise.all(uploadPromises);
};
