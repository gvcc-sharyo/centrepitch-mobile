import multer from "multer";
import path from "path";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|webp/;
  const allowedDocTypes = /pdf|doc|docx|jpeg|jpg|png/;

  const ext = path.extname(file.originalname).toLowerCase().substring(1);

  if (file.fieldname.includes("logo") || file.fieldname.includes("photo") || file.fieldname.includes("Picture") || file.fieldname.includes("courtImages")) {
    if (allowedImageTypes.test(ext) && /image\//.test(file.mimetype)) {
      return cb(null, true);
    }
  }

  // Coaching certificates: images only
  if (file.fieldname === "coachingCertificate") {
    if (allowedImageTypes.test(ext) && /image\//.test(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error("Only image files (JPG, PNG, WEBP) are allowed for coaching certificates"));
  }

  if (
    file.fieldname.includes("document") ||
    file.fieldname.includes("certificate") ||
    file.fieldname.includes("proof") ||
    file.fieldname.includes("License")
  ) {
    if (allowedDocTypes.test(ext)) {
      return cb(null, true);
    }
  }

  if (allowedDocTypes.test(ext)) {
    return cb(null, true);
  }

  cb(new Error("Invalid file type"));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

export const uploadAcademyFiles = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "registrationCertificate", maxCount: 1 },
  { name: "identityProof", maxCount: 1 },
  { name: "taxId", maxCount: 1 },
  { name: "facilityLicense", maxCount: 1 },
]);

export const uploadKycDocuments = upload.fields([
  { name: "documents", maxCount: 10 },
]);

export const uploadLogo = upload.single("logo");

export const uploadCoachFiles = upload.fields([
  { name: "profilePicture", maxCount: 1 },
  { name: "identityProof", maxCount: 1 },
  { name: "coachingCertificate", maxCount: 5 },
  { name: "addressProof", maxCount: 1 },
]);

export const uploadPendingKycFiles = upload.fields([
  { name: "identityProof", maxCount: 1 },
  { name: "coachingCertificate", maxCount: 5 },
  { name: "addressProof", maxCount: 1 },
  { name: "registrationCertificate", maxCount: 1 },
  { name: "taxId", maxCount: 1 },
  { name: "facilityLicense", maxCount: 1 },
]);

// Court images - up to 5 images per court, up to 10 courts = 50 images max
export const uploadCourtImages = upload.array("courtImages", 50);

export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum 5MB",
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  next();
};

export default upload;
