import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, getPublicUrl } from '../config/cloudflare.js';
import crypto from 'crypto';
import path from 'path';

const BUCKET_NAME = process.env.CLOUDFLARE_BUCKET_NAME;

export const uploadToR2 = async (file, folder = 'uploads') => {
  try {
    const fileHash = crypto.randomBytes(16).toString('hex');
    const fileExtension = path.extname(file.originalname);
    const timestamp = Date.now();
    const fileName = `${folder}/${timestamp}-${fileHash}${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: 'max-age=31536000',
    });

    await r2Client.send(command);
    const publicUrl = getPublicUrl(fileName);

    console.log('✅ File uploaded:', publicUrl);

    return {
      url: publicUrl,
      key: fileName,
      size: file.size,
      mimetype: file.mimetype,
      originalName: file.originalname,
    };
  } catch (error) {
    console.error('❌ R2 upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

export const deleteFromR2 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    console.log('✅ File deleted:', key);
    return true;
  } catch (error) {
    console.error('❌ R2 delete error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

export const getFolderByType = (type) => {
  const folderMap = {
    'logo': 'academy-logos',
    'document': 'academy-documents',
    'certificate': 'certificates',
    'license': 'licenses',
    'profile': 'profile-photos',
  };
  return folderMap[type] || 'uploads';
};

export default {
  uploadToR2,
  deleteFromR2,
  getFolderByType,
};