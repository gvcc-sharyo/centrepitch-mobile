/** Populated `academy` from court APIs (see getPublicCourts / getPublicCourtById). */

export function getSportsAcademyName(court) {
  const a = court?.academy;
  if (!a) return '';
  if (typeof a === 'object' && a.name != null) return String(a.name).trim();
  return '';
}

/** City + state from court address, else from populated academy address */
export function getCourtCityStateLine(court) {
  const c = court?.address?.city || court?.academy?.address?.city;
  const s = court?.address?.state || court?.academy?.address?.state;
  return [c, s].filter(Boolean).join(', ');
}
