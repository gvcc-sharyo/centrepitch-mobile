import SportsAcademy from "../../models/SportsAcademy.js";
import User from "../../models/User.js";
import Coach from "../../models/Coach.js";
import KYC from "../../models/Kyc.js";
import { mirrorKycToEntityCollection } from "../../utils/entityAuditStores.js";
import {
  uploadToR2,
  getFolderByType,
} from "../../services/cloudflareService.js";
import sendEmail, { emailTemplates } from "../../utils/sendEmail.js";
import {
  DUPLICATE_EMAIL_MESSAGE,
  DUPLICATE_PHONE_MESSAGE,
} from "../../constants/contactErrors.js";

const normalizePhone = (phone = "") => String(phone || "").trim();
const normalizeEmail = (email = "") => String(email || "").trim().toLowerCase();

export const registerAcademy = async (req, res) => {
  try {
    console.log("📝 Academy registration started");

    const address =
      typeof req.body.address === "string"
        ? JSON.parse(req.body.address)
        : req.body.address;
    const sportsOffered =
      typeof req.body.sportsOffered === "string"
        ? JSON.parse(req.body.sportsOffered)
        : req.body.sportsOffered;
    const facilities =
      typeof req.body.facilities === "string"
        ? JSON.parse(req.body.facilities)
        : req.body.facilities;
    const socialMedia = req.body.socialMedia
      ? typeof req.body.socialMedia === "string"
        ? JSON.parse(req.body.socialMedia)
        : req.body.socialMedia
      : {};

    const academyEmail = normalizeEmail(req.body.email || req.body.adminEmail);
    const adminEmail = normalizeEmail(req.body.adminEmail);
    const academyPhone = normalizePhone(req.body.phone);
    const adminPhone = normalizePhone(req.body.adminPhone);

    if (!academyEmail || !adminEmail) {
      return res.status(400).json({
        success: false,
        message: "Both academy and admin email are required",
      });
    }

    if (academyEmail === adminEmail) {
      return res.status(400).json({
        success: false,
        message: "Academy email and admin email must be different",
      });
    }

    if (!academyPhone || !adminPhone) {
      return res.status(400).json({
        success: false,
        message: "Both academy and admin phone numbers are required",
      });
    }

    if (academyPhone === adminPhone) {
      return res.status(400).json({
        success: false,
        message: "Academy phone and admin phone must be different",
      });
    }

    const academyExists = await SportsAcademy.findOne({
      email: academyEmail,
    });
    if (academyExists) {
      return res.status(400).json({
        success: false,
        message: DUPLICATE_EMAIL_MESSAGE,
      });
    }

    const userExists = await User.findOne({ email: adminEmail });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: DUPLICATE_EMAIL_MESSAGE,
      });
    }

    if (adminEmail) {
      const coachEmailExists = await Coach.findOne({ email: adminEmail });
      if (coachEmailExists) {
        return res.status(400).json({
          success: false,
          message: DUPLICATE_EMAIL_MESSAGE,
        });
      }
    }

    if (academyPhone) {
      const [academyPhoneExists, userPhoneExists, coachPhoneExists] = await Promise.all([
        SportsAcademy.findOne({ phone: academyPhone }),
        User.findOne({ phone: academyPhone }),
        Coach.findOne({ phone: academyPhone }),
      ]);
      if (academyPhoneExists || userPhoneExists || coachPhoneExists) {
        return res.status(400).json({
          success: false,
          message: DUPLICATE_PHONE_MESSAGE,
        });
      }
    }

    if (adminPhone) {
      const [academyAdminPhoneExists, userAdminPhoneExists, coachAdminPhoneExists] = await Promise.all([
        SportsAcademy.findOne({ phone: adminPhone }),
        User.findOne({ phone: adminPhone }),
        Coach.findOne({ phone: adminPhone }),
      ]);
      if (academyAdminPhoneExists || userAdminPhoneExists || coachAdminPhoneExists) {
        return res.status(400).json({
          success: false,
          message: DUPLICATE_PHONE_MESSAGE,
        });
      }
    }

    let logoUrl = null;
    if (req.files?.logo?.[0]) {
      console.log("📤 Uploading logo...");
      const logoResult = await uploadToR2(
        req.files.logo[0],
        getFolderByType("logo"),
      );
      logoUrl = logoResult.url;
      console.log("✅ Logo uploaded:", logoUrl);
    }

    const documents = {};
    const kycDocuments = [];

    if (req.files) {
      if (req.files.registrationCertificate?.[0]) {
        const file = req.files.registrationCertificate[0];
        const result = await uploadToR2(
          file,
          getFolderByType("document"),
        );
        documents.registrationCertificate = result.url;
        kycDocuments.push({
          documentType: "REGISTRATION_CERTIFICATE",
          documentName: file.originalname,
          documentUrl: result.url,
          verificationStatus: "PENDING",
        });
      }

      if (req.files.identityProof?.[0]) {
        const file = req.files.identityProof[0];
        const result = await uploadToR2(
          file,
          getFolderByType("document"),
        );
        documents.identityProof = result.url;
        kycDocuments.push({
          documentType: "IDENTITY_PROOF",
          documentName: file.originalname,
          documentUrl: result.url,
          verificationStatus: "PENDING",
        });
      }

      if (req.files.taxId?.[0]) {
        const file = req.files.taxId[0];
        const result = await uploadToR2(
          file,
          getFolderByType("document"),
        );
        documents.taxId = result.url;
        kycDocuments.push({
          documentType: "TAX_ID",
          documentName: file.originalname,
          documentUrl: result.url,
          verificationStatus: "PENDING",
        });
      }

      if (req.files.facilityLicense?.[0]) {
        const file = req.files.facilityLicense[0];
        const result = await uploadToR2(
          file,
          getFolderByType("license"),
        );
        documents.facilityLicense = result.url;
        kycDocuments.push({
          documentType: "FACILITY_LICENSE",
          documentName: file.originalname,
          documentUrl: result.url,
          verificationStatus: "PENDING",
        });
      }
    }

    const hasRegistrationCertificate = kycDocuments.some(
      (doc) => doc.documentType === "REGISTRATION_CERTIFICATE",
    );
    const hasAdminIdentityProof = kycDocuments.some(
      (doc) => doc.documentType === "IDENTITY_PROOF",
    );
    const hasRequiredKycDocs = hasRegistrationCertificate && hasAdminIdentityProof;

    const parsedYear = parseInt(req.body.establishedYear);

    const academyData = {
      name: req.body.name,
      email: academyEmail,
      phone: academyPhone || "",
      description: req.body.description || "",
      website: req.body.website || undefined,
      logo: logoUrl,
      address: address || {},
      sportsOffered: sportsOffered || [],
      facilities: facilities || [],
      socialMedia: socialMedia || {},
      status: "PENDING",
      kycStatus: hasRequiredKycDocs ? "PENDING" : "INCOMPLETE",
      isActive: true,
    };

    if (!isNaN(parsedYear) && parsedYear >= 1900) {
      academyData.establishedYear = parsedYear;
    }

    const academy = await SportsAcademy.create(academyData);

    academy.metadata = new Map();
    academy.metadata.set("pendingAdminFirstName", req.body.adminFirstName);
    academy.metadata.set("pendingAdminLastName", req.body.adminLastName);
    academy.metadata.set("pendingAdminEmail", adminEmail);
    academy.metadata.set("pendingAdminPhone", adminPhone);
    if (req.body.adminGoogleId) {
      academy.metadata.set("adminGoogleId", req.body.adminGoogleId);
      academy.metadata.set("adminAuthProvider", "google");
    } else {
      academy.metadata.set("pendingAdminPassword", req.body.adminPassword);
    }

    if (Object.keys(documents).length > 0) {
      academy.metadata.set("documents", JSON.stringify(documents));
    }

    await academy.save();

    if (kycDocuments.length > 0) {
      const kyc = await KYC.create({
        entityType: "ACADEMY",
        entityId: academy._id,
        documents: kycDocuments,
        overallStatus: hasRequiredKycDocs ? "PENDING" : "INCOMPLETE",
        submittedAt: Date.now(),
      });
      await mirrorKycToEntityCollection("ACADEMY", kyc);
    }

    // Send academy registration received email
    const adminName = [req.body.adminFirstName, req.body.adminLastName].filter(Boolean).join(' ').trim() || academy.name;
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@centrepitch.com';
    const emailTemplate = emailTemplates.academyRegistrationReceived(adminName, academy.name, supportEmail);
    await sendEmail({
      to: adminEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    console.log("✅ Academy registered:", academy._id);

    res.status(201).json({
      success: true,
      message:
        "Academy registration submitted successfully. Awaiting admin approval.",
      data: {
        academyId: academy._id,
        name: academy.name,
        logo: academy.logo,
        status: academy.status,
        kycStatus: academy.kycStatus,
        documentsUploaded: Object.keys(documents).length,
      },
    });
  } catch (error) {
    console.error("❌ Academy registration error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering academy",
      error: error.message,
    });
  }
};
