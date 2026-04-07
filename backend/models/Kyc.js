import mongoose from "mongoose";

const kycSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["ACADEMY", "COACH", "COURT"],
      required: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "entityType",
    },

    documents: [
      {
        documentType: {
          type: String,
          enum: [
            "REGISTRATION_CERTIFICATE",
            "TAX_ID",
            "IDENTITY_PROOF",
            "ADDRESS_PROOF",
            "COACHING_CERTIFICATE",
            "INSURANCE_DOCUMENT",
            "FACILITY_LICENSE",
            "SAFETY_CERTIFICATE",
            "OTHER",
          ],
          required: true,
        },
        documentName: {
          type: String,
          required: true,
        },
        documentUrl: {
          type: String,
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        verificationStatus: {
          type: String,
          enum: ["PENDING", "VERIFIED", "REJECTED"],
          default: "PENDING",
        },
        verifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        verifiedAt: Date,
        rejectionReason: String,
      },
    ],

    overallStatus: {
      type: String,
      enum: ["INCOMPLETE", "PENDING", "VERIFIED", "REJECTED"],
      default: "INCOMPLETE",
    },

    submittedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    verifiedAt: Date,
    notes: String,
  },
  {
    timestamps: true,
  },
);

kycSchema.index({ entityType: 1, entityId: 1 });
kycSchema.index({ overallStatus: 1 });

kycSchema.methods.hasRequiredDocuments = function () {
  return this.documents && this.documents.length >= 2;
};

kycSchema.methods.allDocumentsVerified = function () {
  if (!this.documents || this.documents.length === 0) return false;
  return this.documents.every((doc) => doc.verificationStatus === "VERIFIED");
};

const KYC = mongoose.model("KYC", kycSchema);

export default KYC;
