import mongoose from "mongoose";

const academyKycSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["ACADEMY"],
      default: "ACADEMY",
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
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
        documentName: { type: String, required: true },
        documentUrl: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        verificationStatus: {
          type: String,
          enum: ["PENDING", "VERIFIED", "REJECTED"],
          default: "PENDING",
        },
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedAt: Date,
    notes: String,
  },
  { timestamps: true, collection: "academy_kycs" }
);

academyKycSchema.index({ entityId: 1 }, { unique: true });
academyKycSchema.index({ overallStatus: 1 });

const AcademyKyc = mongoose.model("AcademyKyc", academyKycSchema);
export default AcademyKyc;

