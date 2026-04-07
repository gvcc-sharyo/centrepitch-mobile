import AcademyKyc from "../models/AcademyKyc.js";
import CoachKyc from "../models/CoachKyc.js";
import AcademyApprovalLog from "../models/AcademyApprovalLog.js";
import CoachApprovalLog from "../models/CoachApprovalLog.js";

const getKycMirrorModel = (entityType) => {
  if (entityType === "ACADEMY") return AcademyKyc;
  if (entityType === "COACH") return CoachKyc;
  return null;
};

const getApprovalMirrorModel = (entityType) => {
  if (entityType === "ACADEMY") return AcademyApprovalLog;
  if (entityType === "COACH") return CoachApprovalLog;
  return null;
};

const toMirrorDoc = (mongooseDoc) => {
  const data = mongooseDoc?.toObject ? mongooseDoc.toObject() : { ...mongooseDoc };
  delete data._id;
  delete data.__v;
  delete data.createdAt;
  delete data.updatedAt;
  return data;
};

export const mirrorKycToEntityCollection = async (entityType, kycDoc) => {
  try {
    const MirrorModel = getKycMirrorModel(entityType);
    if (!MirrorModel || !kycDoc?.entityId) return;

    const payload = toMirrorDoc(kycDoc);
    payload.entityType = entityType;
    await MirrorModel.findOneAndUpdate(
      { entityId: kycDoc.entityId },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.warn(`KYC mirror write failed for ${entityType}:`, error.message);
  }
};

export const mirrorApprovalToEntityCollection = async (logData = {}) => {
  try {
    const MirrorModel = getApprovalMirrorModel(logData.entityType);
    if (!MirrorModel) return;
    await MirrorModel.create(logData);
  } catch (error) {
    console.warn(`Approval log mirror write failed for ${logData.entityType}:`, error.message);
  }
};

