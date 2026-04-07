import KYC from "../models/Kyc.js";
import SportsAcademy from "../models/SportsAcademy.js";
import ApprovalLog from "../models/ApprovalLog.js";
import { uploadToR2 } from "../services/cloudflareService.js";

// ========================================
// ACADEMY ADMIN - Submit KYC Documents
// ========================================
export const submitKycDocuments = async (req, res) => {
  try {
    const { academyId } = req.params;

    // Verify academy exists and belongs to this admin
    const academy = await SportsAcademy.findById(academyId);

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found",
      });
    }

    // Only academy admin who owns it or super admin can submit
    if (
      req.user.role !== "superadmin" &&
      academy.adminUser?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only submit KYC for your own academy",
      });
    }

    // Parse document types from request body
    const documentTypes =
      typeof req.body.documentTypes === "string"
        ? JSON.parse(req.body.documentTypes)
        : req.body.documentTypes;

    const documentNames =
      typeof req.body.documentNames === "string"
        ? JSON.parse(req.body.documentNames)
        : req.body.documentNames;

    if (!req.files || !req.files.documents || req.files.documents.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one document file is required",
      });
    }

    if (
      !documentTypes ||
      !documentNames ||
      documentTypes.length !== req.files.documents.length ||
      documentNames.length !== req.files.documents.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "documentTypes and documentNames arrays must match the number of uploaded files",
      });
    }

    // Upload each document to R2 and build documents array
    const uploadedDocs = [];
    for (let i = 0; i < req.files.documents.length; i++) {
      const file = req.files.documents[i];
      const result = await uploadToR2(file, "kyc-documents");

      uploadedDocs.push({
        documentType: documentTypes[i],
        documentName: documentNames[i],
        documentUrl: result.url,
        verificationStatus: "PENDING",
      });
    }

    // Find existing KYC record or create new one
    let kyc = await KYC.findOne({
      entityType: "ACADEMY",
      entityId: academyId,
    });

    if (kyc) {
      // Replace older docs of same type with newly uploaded docs.
      const uploadedTypes = new Set(uploadedDocs.map((doc) => String(doc?.documentType || "")));
      kyc.documents = (kyc.documents || []).filter(
        (doc) => !uploadedTypes.has(String(doc?.documentType || "")),
      );
      kyc.documents.push(...uploadedDocs);
      kyc.overallStatus = "PENDING";
      kyc.submittedAt = Date.now();
    } else {
      // Create new KYC record
      kyc = new KYC({
        entityType: "ACADEMY",
        entityId: academyId,
        documents: uploadedDocs,
        overallStatus: "PENDING",
        submittedAt: Date.now(),
      });
    }

    await kyc.save();

    // Update academy kycStatus
    academy.kycStatus = "PENDING";
    // Re-submission after rejection should re-enter superadmin review queue.
    if (String(academy.status || "").toUpperCase() === "REJECTED") {
      academy.status = "PENDING";
      academy.rejectionReason = "";
    }
    await academy.save();

    res.status(200).json({
      success: true,
      message: "KYC documents submitted successfully. Awaiting super admin verification.",
      data: {
        kycId: kyc._id,
        overallStatus: kyc.overallStatus,
        totalDocuments: kyc.documents.length,
        documents: kyc.documents,
      },
    });
  } catch (error) {
    console.error("Submit KYC error:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting KYC documents",
      error: error.message,
    });
  }
};

// ========================================
// ACADEMY ADMIN - Get own KYC status
// ========================================
export const getMyKycStatus = async (req, res) => {
  try {
    const { academyId } = req.params;

    const academy = await SportsAcademy.findById(academyId);

    if (!academy) {
      return res.status(404).json({
        success: false,
        message: "Academy not found",
      });
    }

    if (
      req.user.role !== "superadmin" &&
      academy.adminUser?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const kyc = await KYC.findOne({
      entityType: "ACADEMY",
      entityId: academyId,
    }).populate("verifiedBy", "firstName lastName");

    if (!kyc) {
      return res.status(200).json({
        success: true,
        message: "No KYC submission found. Please submit KYC documents.",
        data: {
          kycStatus: academy.kycStatus,
          kyc: null,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        kycStatus: academy.kycStatus,
        kyc,
      },
    });
  } catch (error) {
    console.error("Get KYC status error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching KYC status",
      error: error.message,
    });
  }
};

// ========================================
// SUPER ADMIN - Get all pending KYC submissions
// ========================================
export const getPendingKyc = async (req, res) => {
  try {
    const { page = 1, limit = 10, entityType, search } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));

    let query = { overallStatus: "PENDING" };

    if (entityType) {
      query.entityType = entityType.toUpperCase();
    }

    const totalRecords = await KYC.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / limitNum);

    let kycList = await KYC.find(query)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ submittedAt: 1 });

    // Populate entity details based on entityType
    const populatedList = [];
    for (const kyc of kycList) {
      const kycObj = kyc.toObject();

      if (kyc.entityType === "ACADEMY") {
        const academy = await SportsAcademy.findById(kyc.entityId).select(
          "name email phone logo address status",
        );
        kycObj.entityDetails = academy;
      }

      populatedList.push(kycObj);
    }

    // Filter by search if provided (searches entity name/email)
    let filteredList = populatedList;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredList = populatedList.filter((item) => {
        if (!item.entityDetails) return false;
        return (
          item.entityDetails.name?.toLowerCase().includes(searchLower) ||
          item.entityDetails.email?.toLowerCase().includes(searchLower)
        );
      });
    }

    res.status(200).json({
      success: true,
      count: filteredList.length,
      totalRecords: search ? filteredList.length : totalRecords,
      totalPages: search ? Math.ceil(filteredList.length / limitNum) : totalPages,
      currentPage: pageNum,
      perPage: limitNum,
      data: filteredList,
    });
  } catch (error) {
    console.error("Get pending KYC error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching pending KYC submissions",
      error: error.message,
    });
  }
};

// ========================================
// SUPER ADMIN - Get KYC details by ID
// ========================================
export const getKycById = async (req, res) => {
  try {
    const kyc = await KYC.findById(req.params.id)
      .populate("verifiedBy", "firstName lastName email")
      .populate("documents.verifiedBy", "firstName lastName email");

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC record not found",
      });
    }

    const kycObj = kyc.toObject();

    // Attach entity details
    if (kyc.entityType === "ACADEMY") {
      const academy = await SportsAcademy.findById(kyc.entityId)
        .select("name email phone logo address status kycStatus adminUser")
        .populate("adminUser", "firstName lastName email");
      kycObj.entityDetails = academy;
    }

    res.status(200).json({
      success: true,
      data: kycObj,
    });
  } catch (error) {
    console.error("Get KYC by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching KYC details",
      error: error.message,
    });
  }
};

// ========================================
// SUPER ADMIN - Verify a single KYC document
// ========================================
export const verifyKycDocument = async (req, res) => {
  try {
    const { id, documentId } = req.params;

    const kyc = await KYC.findById(id);

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC record not found",
      });
    }

    const document = kyc.documents.id(documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    if (document.verificationStatus === "VERIFIED") {
      return res.status(400).json({
        success: false,
        message: "Document is already verified",
      });
    }

    document.verificationStatus = "VERIFIED";
    document.verifiedBy = req.user._id;
    document.verifiedAt = Date.now();
    document.rejectionReason = undefined;

    // Check if all documents are now verified
    const allVerified = kyc.documents.every(
      (doc) => doc.verificationStatus === "VERIFIED",
    );

    if (allVerified) {
      kyc.overallStatus = "VERIFIED";
      kyc.verifiedBy = req.user._id;
      kyc.verifiedAt = Date.now();

      // Update academy kycStatus
      if (kyc.entityType === "ACADEMY") {
        await SportsAcademy.findByIdAndUpdate(kyc.entityId, {
          kycStatus: "VERIFIED",
        });
      }
    }

    await kyc.save();

    // Log the action
    await ApprovalLog.createLog({
      entityType: kyc.entityType,
      entityId: kyc.entityId,
      action: "APPROVED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus: "PENDING",
      newStatus: document.verificationStatus,
      notes: `KYC document verified: ${document.documentType} - ${document.documentName}`,
    });

    res.status(200).json({
      success: true,
      message: allVerified
        ? "Document verified. All KYC documents are now verified!"
        : "Document verified successfully",
      data: {
        documentId: document._id,
        documentStatus: document.verificationStatus,
        overallStatus: kyc.overallStatus,
        totalDocuments: kyc.documents.length,
        verifiedCount: kyc.documents.filter(
          (d) => d.verificationStatus === "VERIFIED",
        ).length,
        pendingCount: kyc.documents.filter(
          (d) => d.verificationStatus === "PENDING",
        ).length,
      },
    });
  } catch (error) {
    console.error("Verify KYC document error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying KYC document",
      error: error.message,
    });
  }
};

// ========================================
// SUPER ADMIN - Reject a single KYC document
// ========================================
export const rejectKycDocument = async (req, res) => {
  try {
    const { id, documentId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const kyc = await KYC.findById(id);

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC record not found",
      });
    }

    const document = kyc.documents.id(documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    document.verificationStatus = "REJECTED";
    document.verifiedBy = req.user._id;
    document.verifiedAt = Date.now();
    document.rejectionReason = reason;

    // If any document is rejected, overall status becomes REJECTED
    kyc.overallStatus = "REJECTED";
    kyc.notes = `Document rejected: ${document.documentType} - ${reason}`;

    await kyc.save();

    // Update academy kycStatus
    if (kyc.entityType === "ACADEMY") {
      await SportsAcademy.findByIdAndUpdate(kyc.entityId, {
        kycStatus: "REJECTED",
      });
    }

    // Log the action
    await ApprovalLog.createLog({
      entityType: kyc.entityType,
      entityId: kyc.entityId,
      action: "REJECTED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus: "PENDING",
      newStatus: "REJECTED",
      reason,
      notes: `KYC document rejected: ${document.documentType} - ${document.documentName}`,
    });

    res.status(200).json({
      success: true,
      message: "Document rejected",
      data: {
        documentId: document._id,
        documentStatus: document.verificationStatus,
        rejectionReason: reason,
        overallStatus: kyc.overallStatus,
      },
    });
  } catch (error) {
    console.error("Reject KYC document error:", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting KYC document",
      error: error.message,
    });
  }
};

// ========================================
// SUPER ADMIN - Verify all KYC documents at once
// ========================================
export const verifyAllKycDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const kyc = await KYC.findById(id);

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC record not found",
      });
    }

    if (kyc.overallStatus === "VERIFIED") {
      return res.status(400).json({
        success: false,
        message: "KYC is already verified",
      });
    }

    // Verify all documents
    kyc.documents.forEach((doc) => {
      if (doc.verificationStatus !== "VERIFIED") {
        doc.verificationStatus = "VERIFIED";
        doc.verifiedBy = req.user._id;
        doc.verifiedAt = Date.now();
        doc.rejectionReason = undefined;
      }
    });

    kyc.overallStatus = "VERIFIED";
    kyc.verifiedBy = req.user._id;
    kyc.verifiedAt = Date.now();
    kyc.notes = notes || "All documents verified by super admin";

    await kyc.save();

    // Update academy kycStatus
    if (kyc.entityType === "ACADEMY") {
      await SportsAcademy.findByIdAndUpdate(kyc.entityId, {
        kycStatus: "VERIFIED",
      });
    }

    // Log the action
    await ApprovalLog.createLog({
      entityType: kyc.entityType,
      entityId: kyc.entityId,
      action: "APPROVED",
      actionBy: req.user._id,
      actionByRole: req.user.role,
      previousStatus: "PENDING",
      newStatus: "VERIFIED",
      notes: notes || "All KYC documents verified",
    });

    res.status(200).json({
      success: true,
      message: "All KYC documents verified successfully",
      data: kyc,
    });
  } catch (error) {
    console.error("Verify all KYC documents error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying KYC documents",
      error: error.message,
    });
  }
};
