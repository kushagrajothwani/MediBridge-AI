export type Role = 'patient' | 'doctor' | 'hospital_admin';

export type RecordType =
  | 'encounter'
  | 'diagnosis'
  | 'prescription'
  | 'lab_report'
  | 'allergy'
  | 'discharge';

export const RECORD_TYPES: RecordType[] = [
  'diagnosis',
  'prescription',
  'lab_report',
  'allergy',
  'encounter',
  'discharge',
];

export const RECORD_LABEL: Record<RecordType, string> = {
  encounter: 'Visit note',
  diagnosis: 'Diagnosis',
  prescription: 'Prescription',
  lab_report: 'Lab report',
  allergy: 'Allergy',
  discharge: 'Discharge summary',
};

export interface Hospital {
  id: string;
  name: string;
  short: string; 
  tone: 'a' | 'b';
}

export interface Patient {
  id: string; 
  name: string;
  age: number;
  sex: 'Male' | 'Female';
  bloodGroup: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  title: string;
  hospitalId?: string;
  patientId?: string;
}

export type Extraction = 'OCR + manual review' | 'OCR only' | 'Structured upload' | 'Manual entry';
export type Verification = 'reviewed' | 'pending' | 'unverified';

export interface Provenance {
  extraction: Extraction;
  verification: Verification;
  uploadedAt: string;
  fileName: string;
}

export interface LabValue {
  name: string;
  value: number;
  unit: string;
  refLow: number;
  refHigh: number;
}

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
}

export interface MedicalRecord {
  id: string; // e.g. Report-A-001
  patientId: string;
  hospitalId: string;
  type: RecordType;
  title: string;
  date: string; // ISO
  summary: string;
  provenance: Provenance;
  labs?: LabValue[];
  medications?: Medication[];
  /** Used by the demo "verification" step to show a cross-hospital conflict. */
  reportsNoMedication?: boolean;
}

export type ConsentStatus = 'pending' | 'active' | 'rejected' | 'revoked';
export type ConsentView = ConsentStatus | 'expired';

export interface Consent {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  scope: RecordType[];
  reason: string;
  kind: 'standard' | 'emergency';
  status: ConsentStatus;
  requestedAt: string;
  decidedAt?: string;
  expiresAt?: string;
}

export type AuditAction =
  | 'view_records'
  | 'access_denied'
  | 'consent_requested'
  | 'consent_granted'
  | 'consent_rejected'
  | 'consent_revoked'
  | 'ai_summary'
  | 'record_upload'
  | 'emergency_access';

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  actorHospitalId?: string;
  patientId: string;
  action: AuditAction;
  resource: string;
  reason?: string;
  consent: string;
}
