import Coach from "../../models/Coach.js";
import User from "../../models/User.js";
import SportsAcademy from "../../models/SportsAcademy.js";
import KYC from "../../models/Kyc.js";
import { mirrorKycToEntityCollection } from "../../utils/entityAuditStores.js";
import { uploadToR2 } from "../../services/cloudflareService.js";
import sendEmail, { emailTemplates } from "../../utils/sendEmail.js";
import { DUPLICATE_EMAIL_MESSAGE, DUPLICATE_PHONE_MESSAGE } from "../../constants/contactErrors.js";

/**
 * @desc    Register new coach (Public)
 * @route   POST /api/coaches/register
 * @access  Public
 */
export const registerCoach = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      dateOfBirth,
      gender,
      coachType,
      academy,
      totalExperience,
      bio,
      googleId,
      authProvider,
    } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedPhone = String(phone || "").trim();

    // Handle fields that come as arrays or single values from FormData
    const specialization = Array.isArray(req.body.specialization)
      ? req.body.specialization
      : req.body.specialization
        ? [req.body.specialization]
        : [];

    // Certificate names from the multi-upload form
    const certificateNames = Array.isArray(req.body.certificateNames)
      ? req.body.certificateNames
      : req.body.certificateNames
        ? [req.body.certificateNames]
        : [];

    // Parse address from FormData (address[street], address[city], etc.)
    const address = req.body.address || {};

    console.log("Received coach registration data:", {
      firstName, lastName, email, coachType,
      files: req.files ? Object.keys(req.files) : "none",
    });

    // Check if email already exists in Coach collection
    const coachEmailExists = await Coach.findOne({ email: normalizedEmail });
    if (coachEmailExists) {
      return res.status(400).json({
        success: false,
        message: DUPLICATE_EMAIL_MESSAGE,
      });
    }

    // Check if email already exists in User collection
    const userEmailExists = await User.findOne({ email: normalizedEmail });
    if (normalizedPhone) {
      const [coachPhoneExists, userPhoneExists, academyPhoneExists] = await Promise.all([
        Coach.findOne({ phone: normalizedPhone }),
        User.findOne({ phone: normalizedPhone }),
        SportsAcademy.findOne({
          $or: [{ phone: normalizedPhone }, { "metadata.pendingAdminPhone": normalizedPhone }],
        }),
      ]);
      if (coachPhoneExists || userPhoneExists || academyPhoneExists) {
        return res.status(400).json({
          success: false,
          message: DUPLICATE_PHONE_MESSAGE,
        });
      }
    }

    if (userEmailExists) {
      return res.status(400).json({
        success: false,
        message: DUPLICATE_EMAIL_MESSAGE,
      });
    }

    // Validate academy if provided
    if ((coachType === "ACADEMY_COACH" || coachType === "BOTH") && academy) {
      const academyDoc = await SportsAcademy.findById(academy);
      if (!academyDoc || academyDoc.status !== "APPROVED") {
        return res.status(400).json({
          success: false,
          message: "Selected academy is not available",
        });
      }
    }

    // Specialization is stored as names on the coach; user-scoped UserSport rows
    // are created when the coach is linked to a user account and updates their profile.

    // Upload profile picture to R2 if provided
    let profilePhotoUrl = null;
    if (req.files?.profilePicture?.[0]) {
      const result = await uploadToR2(req.files.profilePicture[0], "coach-profiles");
      profilePhotoUrl = result.url;
    }

    // Upload KYC documents to R2
    const kycDocuments = [];

    if (req.files?.identityProof?.[0]) {
      const result = await uploadToR2(req.files.identityProof[0], "kyc-documents");
      kycDocuments.push({
        documentType: "IDENTITY_PROOF",
        documentName: req.files.identityProof[0].originalname,
        documentUrl: result.url,
        verificationStatus: "PENDING",
      });
    }

    // Handle multiple coaching certificate files (up to 5)
    if (req.files?.coachingCertificate) {
      for (let i = 0; i < req.files.coachingCertificate.length; i++) {
        const file = req.files.coachingCertificate[i];
        const result = await uploadToR2(file, "kyc-documents");
        kycDocuments.push({
          documentType: "COACHING_CERTIFICATE",
          documentName: certificateNames[i] || file.originalname,
          documentUrl: result.url,
          verificationStatus: "PENDING",
        });
      }
    }

    if (req.files?.addressProof?.[0]) {
      const result = await uploadToR2(req.files.addressProof[0], "kyc-documents");
      kycDocuments.push({
        documentType: "ADDRESS_PROOF",
        documentName: req.files.addressProof[0].originalname,
        documentUrl: result.url,
        verificationStatus: "PENDING",
      });
    }

    // All coach types start as PENDING
    const initialStatus = "PENDING";
    const kycStatus = kycDocuments.length > 0 ? "PENDING" : "INCOMPLETE";

    // Create coach profile (NO user account yet - created after approval)
    const coachData = {
      firstName,
      lastName,
      email: normalizedEmail,
      phone: normalizedPhone || "",
      dateOfBirth,
      profilePhoto: profilePhotoUrl,
      coachType: coachType || "FREELANCER",
      academies:
        (coachType === "ACADEMY_COACH" || coachType === "BOTH") && academy
          ? [{ academy, status: "PENDING" }]
          : [],
      specialization: specialization || [],
      totalExperience: parseInt(totalExperience) || 0,
      certifications: certificateNames.filter(n => n && n.trim()),
      qualifications: [],
      previousExperience: [],
      bio: bio || "",
      availability: "FLEXIBLE",
      status: initialStatus,
      kycStatus,
      isActive: true,
      isAvailableForBooking: false,
      isFeatured: false,
      languages: [],
      achievements: [],
      averageRating: 0,
      totalReviews: 0,
      totalStudentsTaught: 0,
      totalSessionsConducted: 0,
    };

    if (gender && gender.trim()) {
      coachData.gender = gender.toUpperCase();
    }

    const coach = await Coach.create(coachData);

    // Store user credentials in metadata
    coach.metadata = new Map();
    coach.metadata.set("pendingUserEmail", normalizedEmail);
    if (googleId) {
      coach.metadata.set("googleId", googleId);
      coach.metadata.set("authProvider", "google");
    } else {
      coach.metadata.set("pendingUserPassword", password);
    }
    coach.metadata.set("address", JSON.stringify(address));
    await coach.save();

    // Send coach registration received email
    const coachName = [firstName, lastName].filter(Boolean).join(" ").trim() || "Coach";
    const supportEmail = process.env.SUPPORT_EMAIL || "support@centrepitch.com";
    const emailTemplate = emailTemplates.coachRegistrationReceived(coachName, supportEmail);
    await sendEmail({
      to: normalizedEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    // Create KYC record if documents were uploaded
    if (kycDocuments.length > 0) {
      const kyc = await KYC.create({
        entityType: "COACH",
        entityId: coach._id,
        documents: kycDocuments,
        overallStatus: "PENDING",
        submittedAt: Date.now(),
      });
      await mirrorKycToEntityCollection("COACH", kyc);

      coach.kycDocuments = kyc._id;
      await coach.save();
    }

    // If academy coach, add to academy's coaches list
    if ((coachType === "ACADEMY_COACH" || coachType === "BOTH") && academy) {
      await SportsAcademy.findByIdAndUpdate(academy, {
        $push: { coaches: coach._id },
      });
    }

    console.log("Coach created successfully:", coach._id);

    res.status(201).json({
      success: true,
      message: "Coach registration submitted successfully. Awaiting approval.",
      data: {
        coachId: coach._id,
        name: `${firstName} ${lastName}`,
        status: coach.status,
        kycStatus: coach.kycStatus,
        documentsUploaded: kycDocuments.length,
        nextStep:
          coachType === "ACADEMY_COACH"
            ? "Academy admin will review your application first"
            : coachType === "BOTH"
              ? "Your application will be reviewed by both academy and admin"
              : "Super admin will review your application",
      },
    });
  } catch (error) {
    console.error("Coach registration error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering coach",
      error: error.message,
    });
  }
};