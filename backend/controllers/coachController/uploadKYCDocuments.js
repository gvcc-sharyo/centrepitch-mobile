import Coach from "../../models/Coach.js";
import KYC from "../../models/Kyc.js";
import { mirrorKycToEntityCollection } from "../../utils/entityAuditStores.js";
import { uploadToR2 } from "../../services/cloudflareService.js";

/**
 * @desc    Upload KYC documents
 * @route   POST /api/coaches/:id/kyc
 * @access  Private/Coach
 */
export const uploadKYCDocuments = async (req, res) => {
  try {
    const coach = await Coach.findById(req.params.id);

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    let incomingDocs = [];
    const hasFileUpload = Array.isArray(req.files?.documents) && req.files.documents.length > 0;

    if (hasFileUpload) {
      const documentTypes =
        typeof req.body?.documentTypes === "string"
          ? JSON.parse(req.body.documentTypes)
          : req.body?.documentTypes;
      const documentNames =
        typeof req.body?.documentNames === "string"
          ? JSON.parse(req.body.documentNames)
          : req.body?.documentNames;

      if (
        !Array.isArray(documentTypes) ||
        !Array.isArray(documentNames) ||
        documentTypes.length !== req.files.documents.length ||
        documentNames.length !== req.files.documents.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            "documentTypes and documentNames arrays must match the number of uploaded files",
        });
      }

      for (let i = 0; i < req.files.documents.length; i += 1) {
        const file = req.files.documents[i];
        // eslint-disable-next-line no-await-in-loop
        const uploaded = await uploadToR2(file, "kyc-documents");
        incomingDocs.push({
          documentType: documentTypes[i],
          documentName: documentNames[i],
          documentUrl: uploaded.url,
        });
      }
    } else {
      const { documents } = req.body || {};
      if (Array.isArray(documents)) {
        incomingDocs = documents;
      } else if (typeof documents === "string") {
        try {
          const parsed = JSON.parse(documents);
          incomingDocs = Array.isArray(parsed) ? parsed : [];
        } catch {
          incomingDocs = [];
        }
      }
    }

    if (!Array.isArray(incomingDocs) || incomingDocs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one document is required",
      });
    }

    let kyc = await KYC.findOne({
      entityType: "COACH",
      entityId: coach._id,
    });

    if (!kyc) {
      kyc = await KYC.create({
        entityType: "COACH",
        entityId: coach._id,
        documents: incomingDocs.map((doc) => ({
          ...doc,
          verificationStatus: "PENDING",
        })),
        overallStatus: "PENDING",
        submittedAt: Date.now(),
      });
    } else {
      const incomingTypes = new Set(incomingDocs.map((doc) => String(doc?.documentType || "")));
      // Replace older docs of same type with the newly uploaded version.
      kyc.documents = (kyc.documents || []).filter(
        (doc) => !incomingTypes.has(String(doc?.documentType || "")),
      );
      kyc.documents.push(
        ...incomingDocs.map((doc) => ({
          ...doc,
          verificationStatus: "PENDING",
        })),
      );
      kyc.overallStatus = "PENDING";
      kyc.submittedAt = Date.now();
      await kyc.save();
    }

    coach.kycDocuments = kyc._id;
    coach.kycStatus = "PENDING";
    // Re-submission after rejection should re-enter superadmin review queue.
    if (String(coach.status || "").toUpperCase() === "REJECTED") {
      coach.status = "PENDING";
      coach.rejectionReason = "";
    }
    await coach.save();
    await mirrorKycToEntityCollection("COACH", kyc);

    res.status(200).json({
      success: true,
      message: "KYC documents uploaded successfully",
      data: kyc,
    });
  } catch (error) {
    console.error("Upload KYC error:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading KYC documents",
      error: error.message,
    });
  }
};