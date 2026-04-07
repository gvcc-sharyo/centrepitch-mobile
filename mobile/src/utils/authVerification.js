export const needsAuthVerification = (payload) => {
  if (!payload || typeof payload !== "object") return false;

  if (payload.needsVerification) return true;
  if (payload.verificationPending) return true;
  if (payload.needsEmailVerification) return true;
  if (payload.needsPhoneVerification) return true;
  if (payload.isEmailVerified === false) return true;
  if (payload.emailVerified === false) return true;
  if (payload.isPhoneVerified === false) return true;

  return false;
};
