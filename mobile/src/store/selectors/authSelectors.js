/**
 * Auth-related Redux selectors kept in a separate module (no authService / slice side effects).
 * Import these instead of `selectPhoneVerified` from authSlice to avoid Hermes/Metro
 * "Property 'selectPhoneVerified' doesn't exist" with named exports from the slice bundle.
 */

export function selectPhoneVerified(state) {
  const u = state?.auth?.user;
  if (u && typeof u === "object") {
    if (typeof u.isPhoneVerified === "boolean") return u.isPhoneVerified;
    if (typeof u.phoneVerified === "boolean") return u.phoneVerified;
  }
  return Boolean(state?.auth?.phoneVerified);
}
