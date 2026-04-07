import sharp from 'sharp';
import { uploadSingleImage } from '../utils/cloudFlareUpload.js';

// Upload Event Banner Image
export const uploadEventImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    // Optimize image for event banner
    const optimizedBuffer = await sharp(req.file.buffer)
      .resize(1440, 500, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toBuffer();

    const optimizedFile = {
      ...req.file,
      buffer: optimizedBuffer,
      mimetype: 'image/webp',
      originalname: req.file.originalname.replace(/\.[^/.]+$/, '.webp'),
    };

    // Upload to Cloudflare R2
    const imageUrl = await uploadSingleImage(optimizedFile, 'event_images');
    
    res.status(200).json({ 
      success: true,
      message: 'Image uploaded successfully',
      data: { url: imageUrl }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
};

// Upload QR Code Image
export const uploadQRCode = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }

    const image = sharp(req.file.buffer);
    const metadata = await image.metadata();

    // Only resize if QR is too large
    let optimizedImage = image;

    if (metadata.width > 1000 || metadata.height > 1000) {
      optimizedImage = image.resize({
        width: 1000,
        height: 1000,
        fit: 'contain',
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      });
    }

    // Lossless format for QR - best quality
    const optimizedBuffer = await optimizedImage
      .png({ compressionLevel: 9 })
      .toBuffer();

    const optimizedFile = {
      ...req.file,
      buffer: optimizedBuffer,
      mimetype: 'image/png',
      originalname: req.file.originalname.replace(/\.[^/.]+$/, '.png'),
    };

    const imageUrl = await uploadSingleImage(optimizedFile, 'qr_codes');

    res.status(200).json({ 
      success: true,
      message: 'QR Code uploaded successfully',
      data: { url: imageUrl }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to upload QR code',
      error: error.message
    });
  }
};

// Upload Profile Photo
export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }

    // Optimize image for profile
    const optimizedBuffer = await sharp(req.file.buffer)
      .resize(300, 300, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toBuffer();

    const optimizedFile = {
      ...req.file,
      buffer: optimizedBuffer,
      mimetype: 'image/webp',
      originalname: req.file.originalname.replace(/\.[^/.]+$/, '.webp'),
    };

    const imageUrl = await uploadSingleImage(optimizedFile, 'profile_photos');

    res.status(200).json({ 
      success: true,
      message: 'Profile photo uploaded successfully',
      data: { url: imageUrl }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to upload profile photo',
      error: error.message
    });
  }
};

// Upload Team Logo
export const uploadTeamLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }

    // Optimize image for team logo
    const optimizedBuffer = await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toBuffer();

    const optimizedFile = {
      ...req.file,
      buffer: optimizedBuffer,
      mimetype: 'image/webp',
      originalname: req.file.originalname.replace(/\.[^/.]+$/, '.webp'),
    };

    const imageUrl = await uploadSingleImage(optimizedFile, 'team_logos');

    res.status(200).json({ 
      success: true,
      message: 'Team logo uploaded successfully',
      data: { url: imageUrl }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to upload team logo',
      error: error.message
    });
  }
};

// Generic file upload
export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }

    const folder = req.query.folder || 'uploads';
    const imageUrl = await uploadSingleImage(req.file, folder);

    res.status(200).json({ 
      success: true,
      message: 'File uploaded successfully',
      data: { url: imageUrl }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to upload file',
      error: error.message
    });
  }
};