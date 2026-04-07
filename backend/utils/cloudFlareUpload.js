import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { getPublicUrl } from '../config/cloudflare.js';
dotenv.config();

const r2 = new S3Client({
  region: process.env.CLOUDFLARE_BUCKET_REGION || 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  }
});

// Upload single image to Cloudflare R2
 const uploadSingleImage = async (file, folder = 'images') => {
  const fileKey = `${folder}/${Date.now()}-${file.originalname}`;

  const params = {
    Bucket: process.env.CLOUDFLARE_BUCKET_NAME || 'sports-events',
    Key: fileKey,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const command = new PutObjectCommand(params);
  await r2.send(command);

  // Public URL
  const publicUrl = getPublicUrl(fileKey);

  console.log(`Image uploaded successfully: ${publicUrl}`);

  return publicUrl;
};

// Delete image from Cloudflare R2
 const deleteImage = async (imageUrl) => {
  try {
    // Extract the key from the URL
    const urlParts = imageUrl.split('.r2.dev/');
    if (urlParts.length < 2) return false;
    
    const fileKey = urlParts[1];

    const params = {
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME || 'sports-events',
      Key: fileKey,
    };

    const command = new DeleteObjectCommand(params);
    await r2.send(command);

    console.log(`Image deleted successfully: ${fileKey}`);
    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
};

export { uploadSingleImage, deleteImage };