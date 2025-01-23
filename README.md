# Bulk Image Processing and Deletion API

This project provides APIs to process images in bulk (remove backgrounds, upload to AWS S3, and invalidate CloudFront cache) and delete images from AWS S3 in batches.

## Features

- Download images from AWS S3.
- Process images using the `rembg` library to remove backgrounds.
- Upload processed and renamed images back to AWS S3.
- Invalidate AWS CloudFront cache for updated images.
- Delete multiple images from S3 in a single request.

## Prerequisites

1. Node.js installed.
2. AWS credentials with access to S3 and CloudFront.
3. `.env` file with:
   ```env
   AMAZON_ACCESS_KEY=your-access-key
   AMAZON_SECRET_ACCESS_KEY=your-secret-key
   AMAZON_REGION=your-region
   AMAZON_BUCKET_NAME=your-bucket-name
   CLOUDFRONT_DISTRIBUTIONS_ID=your-distribution-id
   ```
4. Install `rembg` globally: `pip install rembg`.

## Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the server:
   ```bash
   node index.js
   ```

The server will start at `http://localhost:3000`.

## API Endpoints

### 1. Process Images

**Endpoint:** `POST /process-images`

**Description:** Downloads images from S3, processes them (removes backgrounds), uploads renamed and processed images back to S3, and invalidates CloudFront cache.

**Request Payload:**
```json
{
  "imageKeys": ["image1.png", "image2.png"]
}
```

**Response:**
```json
{
  "message": "Images processed successfully.",
  "result": [
    {
      "originalKey": "image1.png",
      "newInputKey": "image1.png-backup"
    },
    {
      "originalKey": "image2.png",
      "newInputKey": "image2.png-backup"
    }
  ]
}
```

### 2. Delete Images

**Endpoint:** `DELETE /delete-images`

**Description:** Deletes multiple images from AWS S3 in a batch.

**Request Payload:**
```json
{
  "imageKeys": ["image1.png", "image2.png"]
}
```

**Response:**
```json
{
  "message": "Images deleted successfully.",
  "result": {
    "Deleted": [
      {"Key": "image1.png"},
      {"Key": "image2.png"}
    ],
    "Errors": []
  }
}
```

## How It Works

1. **Process Images**
   - Downloads images from S3.
   - Saves them locally and processes them using `rembg`.
   - Renamed and processed images are uploaded to S3.
   - CloudFront cache is invalidated for the updated images.

2. **Delete Images**
   - Deletes the specified images from the S3 bucket in a single batch request.

## Example Payloads

### Process Images
```json
{
  "imageKeys": ["image1.png", "image2.png"]
}
```

### Delete Images
```json
{
  "imageKeys": ["image1.png", "image2.png"]
}
```

## Example Responses

### Process Images Response
```json
{
  "message": "Images processed successfully.",
  "result": [
    {
      "originalKey": "image1.png",
      "newInputKey": "image1.png-backup"
    }
  ]
}
```

### Delete Images Response
```json
{
  "message": "Images deleted successfully.",
  "result": {
    "Deleted": [
      {"Key": "image1.png"},
      {"Key": "image2.png"}
    ],
    "Errors": []
  }
}
```

---

## License

MIT

