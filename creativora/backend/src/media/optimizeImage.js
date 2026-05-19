const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({});

/**
 * Triggered via S3 bucket notification on .jpg/.png uploads.
 * Converts to WebP and generates a thumbnail.
 * Note: sharp requires a Lambda layer or container image for native binaries.
 * For Phase 1, this logs the event and is a placeholder for the full implementation.
 */
exports.handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log('Image optimization triggered', { bucket, key });

    // TODO: Add sharp-based WebP conversion + thumbnail generation
    // Requires sharp Lambda layer: https://github.com/Umkus/lambda-layer-sharp
  }
};
