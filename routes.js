import express from 'express';
import { processImagesInBulk,deleteBatchFromS3 } from './bgRemove.js';
import { downloadImagesInBatch,uploadBatchToAWS } from './scripts.js';
const router = express.Router();

// API endpoint for batch downloading images
router.post('/download-images', async (req, res) => {
  const { imageKeys } = req.body; // Expecting an array of image keys

  if (!Array.isArray(imageKeys) || imageKeys.length === 0) {
    return res.status(400).json({ error: 'An array of image keys is required.' });
  }

  try {
    const downloadedFiles = await downloadImagesInBatch(imageKeys);
    res.json({ message: 'Images downloaded successfully.', files: downloadedFiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for batch uploading images to S3
router.post('/upload-images', async (req, res) => {
  try {
    const uploadedFiles = await uploadBatchToAWS();
    res.json({ message: 'Images uploaded successfully.', files: uploadedFiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/process-images', async (req, res) => {
  const { imageKeys } = req.body; // Expecting an array of image keys

  if (!Array.isArray(imageKeys) || imageKeys.length === 0) {
    return res.status(400).json({ error: 'An array of image keys is required.' });
  }

  try {
    const result = await processImagesInBulk(imageKeys);
    res.json({ message: 'Images processed successfully.', result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/delete-images', async (req, res) => {
  const { imageKeys } = req.body; // Expecting an array of image keys

  if (!Array.isArray(imageKeys) || imageKeys.length === 0) {
    return res.status(400).json({ error: 'An array of image keys is required.' });
  }

  try {
    const result = await deleteBatchFromS3(imageKeys);
    res.json({ message: 'Images deleted successfully.', result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


export default router;
