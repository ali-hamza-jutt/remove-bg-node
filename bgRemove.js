import AWS from 'aws-sdk';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AMAZON_ACCESS_KEY,
  secretAccessKey: process.env.AMAZON_SECRET_ACCESS_KEY,
  region: process.env.AMAZON_REGION,
});

const cloudfront = new AWS.CloudFront(); // CloudFront client

const BUCKET_NAME = process.env.DEV_AWS_BUCKET_NAME;
const CLOUDFRONT_DISTRIBUTION_ID = process.env.DEV_CLOUDFRONT_DISTRIBUTIONS_ID;

const INPUT_FOLDER = path.join(path.resolve(), 'input');
const OUTPUT_FOLDER = path.join(path.resolve(), 'output');

// Ensure directories exist
[INPUT_FOLDER, OUTPUT_FOLDER].forEach((folder) => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  }
});

// Function to generate a new key for renamed images
const generateRenamedKey = (originalKey) => {
  return `${originalKey}-backup`;
};

// Function to download images from S3 in batch
const downloadFromS3 = (keys) => {
  return new Promise((resolve, reject) => {
    // Prepare S3 download requests for each key
    const downloadPromises = keys.map((key) => {
      const params = {
        Bucket: BUCKET_NAME,
        Key: key,
      };
      return s3.getObject(params).promise()
        .then((data) => ({ key, buffer: data.Body }))
        .catch((err) => {
          console.error(`Failed to download ${key}:`, err);
          throw err; // Reject on error
        });
    });

    // Resolve all download promises
    Promise.all(downloadPromises)
      .then((results) => resolve(results))
      .catch((err) => reject(err));
  });
};

// Function to remove background from an image
const removeBackground = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    execFile('rembg', ['i', inputPath, outputPath], (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
};

// Function to upload batch to S3
export const uploadBatchToS3 = async (uploads) => {
  try {
    // Ensure uploads are not empty
    if (uploads.length === 0) {
      console.log("No images to upload.");
      return [];
    }

    const uploadPromises = uploads.map(({ key, buffer }) => {
      const params = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: 'image/png', // Adjust as needed
      };

      console.log(`Uploading ${key}...`); // Add debug log for tracking upload progress
      return s3.upload(params).promise();
    });

    const results = await Promise.all(uploadPromises);
    console.log('Batch upload completed successfully:', results);
    return results;
  } catch (error) {
    console.error('Error uploading batch to S3:', error);
    throw error;
  }
};

// Function to invalidate CloudFront cache
const invalidateCloudFrontCache = (keys) => {
  return new Promise((resolve, reject) => {
    const cloudfront = new AWS.CloudFront({
      accessKeyId: process.env.AMAZON_ACCESS_KEY,
      secretAccessKey: process.env.AMAZON_SECRET_ACCESS_KEY,
    });

    const params = {
      DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: `${Date.now()}`,
        Paths: {
          Quantity: keys.length,
          Items: keys.map((key) => `/${key}`),
        },
      },
    };

    cloudfront.createInvalidation(params, (err, data) => {
      if (err) {
        console.error('CloudFront invalidation error:', err);
        reject(err);
      } else {
        console.log('CloudFront invalidation created:');
        console.log(`Invalidation ID: ${data.Invalidation.Id}`);
        console.log(`Invalidation Status: ${data.Invalidation.Status}`);
        resolve(data);
      }
    });
  });
};

// Main function to process images in bulk
export const processImagesInBulk = async (imageKeys) => {
  try {
    const processedImages = [];

    console.log('Downloading images...');
    // Download images in batch
    const images = await downloadFromS3(imageKeys);

    const renamedUploads = [];
    const processedUploads = [];

    for (let i = 0; i < images.length; i++) {
      const { key, buffer } = images[i];
      const renamedKey = generateRenamedKey(key);
      const inputPath = path.join(INPUT_FOLDER, `${path.basename(renamedKey)}.png`);
      const outputPath = path.join(OUTPUT_FOLDER, `${path.basename(key)}.png`);

      // Ensure buffer is written to disk
      fs.writeFileSync(inputPath, buffer);
      console.log(`Saved renamed input image locally: ${inputPath}`);

      await removeBackground(inputPath, outputPath);

      // Ensure output file exists and is correctly written
      const processedBuffer = fs.readFileSync(outputPath);

      if (!processedBuffer || processedBuffer.length === 0) {
        console.error(`Processed buffer for ${key} is empty or invalid.`);
        throw new Error(`Processed buffer for ${key} is empty or invalid.`);
      }

      processedUploads.push({ key, buffer: processedBuffer });
      renamedUploads.push({ key: renamedKey, buffer });

      processedImages.push({ originalKey: key, newInputKey: renamedKey });
    }

    console.log('Uploading renamed input images...');
    await uploadBatchToS3(renamedUploads);

    console.log('Uploading processed images...');
    await uploadBatchToS3(processedUploads);

    console.log('Invalidating CloudFront cache...');
    const invalidationPaths = [
      ...renamedUploads.map(({ key }) => key),
      ...processedUploads.map(({ key }) => key),
    ];
    await invalidateCloudFrontCache(invalidationPaths);

    console.log('All images processed, uploaded, and cache invalidated successfully.');
    return processedImages;
  } catch (error) {
    console.error('Error processing images in bulk:', error);
    throw error;
  }
};

// Function to delete objects in batch from S3
export const deleteBatchFromS3 = async (keys) => {
  console.log('Keys to delete:', keys); // Add this
  const params = {
    Bucket: BUCKET_NAME,
    Delete: {
      Objects: keys.map((key) => ({ Key: key })),
    },
  };

  try {
    const result = await s3.deleteObjects(params).promise();
    console.log('Delete result:', result); // Add this
    return result;
  } catch (error) {
    console.error('Error deleting objects:', error);
    throw error;
  }
};
