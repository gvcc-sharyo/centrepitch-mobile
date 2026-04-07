import Coach from "../models/Coach.js";
import SportsAcademy from "../models/SportsAcademy.js";
import KYC from "../models/Kyc.js";
import { uploadToR2, getFolderByType } from "../services/cloudflareService.js";

/**
 * @desc    Submit KYC documents for pending coach/academy (before approval)
 * @route   POST /api/pending/kyc
 * @access  Private (pending token)
 */
export const submitPendingKyc = async (req, res) => {
  try {
    if (!req.isPending) {
      return res.status(400).json({
        success: false,
        message: "This endpoint is for pending registrations only",
      });
    }

    const entity = req.pendingEntity;
    const role = req.pendingRole;
    const entityType = role === "coach" ? "COACH" : "ACADEMY";

    const kycDocuments = [];

    if (req.files) {
      if (req.files.identityProof?.[0]) {
        const result = await uploadToR2(
          req.files.identityProof[0],
          "kyc-documents",
        );
        kycDocuments.push({
          documentType: "IDENTITY_PROOF",
          documentName: req.files.identityProof[0].originalname,
          documentUrl: result.url,
          verificationStatus: "PENDING",
        });
      }

      if (req.files.coachingCertificate) {
        const certNames = Array.isArray(req.body.certificateNames)
          ? req.body.certificateNames
          : req.body.certificateNames
            ? [req.body.certificateNames]
            : [];

        for (let i = 0; i < req.files.coachingCertificate.length; i++) {
          const file = req.files.coachingCertificate[i];
          const result = await uploadToR2(file, "kyc-documents");
          kycDocuments.push({
            documentType: "COACHING_CERTIFICATE",
            documentName: certNames[i] || file.originalname,
            documentUrl: result.url,
            verificationStatus: "PENDING",
          });
        }
      }

      if (req.files.addressProof?.[0]) {
        const result = await uploadToR2(
          req.files.addressProof[0],
          "kyc-documents",
        );
        kycDocuments.push({
          documentType: "ADDRESS_PROOF",
          documentName: req.files.addressProof[0].originalname,
          documentUrl: result.url,
          verificationStatus: "PENDING",
        });
      }

      if (req.files.registrationCertificate?.[0]) {
        const result = await uploadToR2(
          req.files.registrationCertificate[0],
          getFolderByType("document"),
        );
        kycDocuments.push({
          documentType: "REGISTRATION_CERTIFICATE",
          documentName: req.files.registrationCertificate[0].originalname,
          documentUrl: result.url,
          verificationStatus: "PENDING",
        });
      }

      if (req.files.taxId?.[0]) {
        const result = await uploadToR2(
          req.files.taxId[0],
          getFolderByType("document"),
        );
        kycDocuments.push({
          documentType: "TAX_ID",
          documentName: req.files.taxId[0].originalname,
          documentUrl: result.url,
          verificationStatus: "PENDING",
        });
      }

      if (req.files.facilityLicense?.[0]) {
        const result = await uploadToR2(
          req.files.facilityLicense[0],
          getFolderByType("license"),
        );
        kycDocuments.push({
          documentType: "FACILITY_LICENSE",
          documentName: req.files.facilityLicense[0].originalname,
          documentUrl: result.url,
          verificationStatus: "PENDING",
        });
      }
    }

    if (kycDocuments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one document is required",
      });
    }

    let kyc = await KYC.findOne({ entityType, entityId: entity._id });

    if (!kyc) {
      kyc = await KYC.create({
        entityType,
        entityId: entity._id,
        documents: kycDocuments,
        overallStatus: "PENDING",
        submittedAt: Date.now(),
      });
    } else {
      kyc.documents.push(...kycDocuments);
      kyc.overallStatus = "PENDING";
      kyc.submittedAt = Date.now();
      await kyc.save();
    }

    if (role === "coach") {
      entity.kycDocuments = kyc._id;
      entity.kycStatus = "PENDING";
      await entity.save();
    } else {
      entity.kycStatus = "PENDING";
      await entity.save();
    }

    res.json({
      success: true,
      message: "KYC documents submitted successfully. Awaiting approval.",
      data: {
        kycStatus: "PENDING",
        documentsUploaded: kycDocuments.length,
      },
    });
  } catch (error) {
    console.error("Pending KYC submit error:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting KYC documents",
      error: error.message,
    });
  }
};

/**
 * @desc    Get pending user status (KYC + approval)
 * @route   GET /api/pending/status
 * @access  Private (pending token)
 */
export const getPendingStatus = async (req, res) => {
  try {
    if (!req.isPending) {
      return res.status(400).json({
        success: false,
        message: "This endpoint is for pending registrations only",
      });
    }

    const entity = req.pendingEntity;
    const role = req.pendingRole;

    res.json({
      success: true,
      data: {
        _id: entity._id,
        firstName: role === "coach" ? entity.firstName : entity.metadata?.get("pendingAdminFirstName") || entity.name,
        lastName: role === "coach" ? entity.lastName : entity.metadata?.get("pendingAdminLastName") || "",
        email: role === "coach" ? entity.email : entity.metadata?.get("pendingAdminEmail"),
        pendingRole: role,
        status: entity.status,
        kycStatus: entity.kycStatus,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching status",
    });
  }
};
