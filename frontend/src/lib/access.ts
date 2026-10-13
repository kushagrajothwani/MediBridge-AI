import type { Consent, ConsentView, MedicalRecord, User } from '../types';

/** Placeholder records stand in for records the backend says exist but won't show. */
export const LOCKED_PREFIX = 'locked:';

/** What the user sees: an "active" consent past its end time is shown as expired. */
export function consentState(c: Consent, now = Date.now()): ConsentView {
  if (c.status === 'active' && c.expiresAt && new Date(c.expiresAt).getTime() <= now) return 'expired';
  return c.status;
}

export const isActive = (c: Consent, now = Date.now()) => consentState(c, now) === 'active';

/**
 * The single rule that decides whether a record can be read.
 * The backend enforces the same rule on every request.
 * The UI only mirrors it so the screens can explain what is locked and why.
 */
export function canView(rec: MedicalRecord, viewer: User, consents: Consent[], now = Date.now()): boolean {
  if (rec.id.startsWith(LOCKED_PREFIX)) return false;
  if (viewer.role === 'patient') return rec.patientId === viewer.patientId;
  if (viewer.hospitalId === rec.hospitalId) return true; // a hospital always reads its own records
  if (viewer.role === 'hospital_admin') return false; // admins never read other hospitals' data
  return consents.some(
    (c) =>
      c.patientId === rec.patientId &&
      c.doctorId === viewer.id &&
      isActive(c, now) &&
      c.scope.includes(rec.type),
  );
}

export function splitRecords(
  records: MedicalRecord[],
  patientId: string,
  viewer: User,
  consents: Consent[],
) {
  const mine = records.filter((r) => r.patientId === patientId);
  const visible = mine.filter((r) => canView(r, viewer, consents));
  const locked = mine.filter((r) => !canView(r, viewer, consents));
  return { visible, locked };
}