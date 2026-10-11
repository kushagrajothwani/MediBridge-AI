import type { AuditEvent, Consent, Hospital, MedicalRecord, Patient, User } from '../types';

// All data in this file is synthetic.

export const HOSPITALS: Hospital[] = [
  { id: 'H-A', name: 'Sunrise General Hospital', short: 'Hospital A', tone: 'a' },
  { id: 'H-B', name: 'CityCare Hospital', short: 'Hospital B', tone: 'b' },
];
export const hospitalById = (id?: string) => HOSPITALS.find((h) => h.id === id);

export const PATIENTS: Patient[] = [
  { id: 'MB-PAT-1001', name: 'Rahul Sharma', age: 46, sex: 'Male', bloodGroup: 'B+' },
  { id: 'MB-PAT-1002', name: 'Anita Desai', age: 34, sex: 'Female', bloodGroup: 'O+' },
];
export const patientById = (id?: string) => PATIENTS.find((p) => p.id === id);

export const USERS: User[] = [
  { id: 'U-PAT-1', name: 'Rahul Sharma', role: 'patient', title: 'Patient', patientId: 'MB-PAT-1001' },
  { id: 'D-B-01', name: 'Dr. Meera Iyer', role: 'doctor', title: 'Internal Medicine', hospitalId: 'H-B' },
  { id: 'D-A-01', name: 'Dr. Arjun Rao', role: 'doctor', title: 'Endocrinology', hospitalId: 'H-A' },
  { id: 'AD-A-01', name: 'Anil Verma', role: 'hospital_admin', title: 'Records administrator', hospitalId: 'H-A' },
  { id: 'AD-B-01', name: 'Sonal Gupta', role: 'hospital_admin', title: 'Records administrator', hospitalId: 'H-B' },
];

export const seedRecords = (): MedicalRecord[] => [
  {
    id: 'Report-A-001',
    patientId: 'MB-PAT-1001',
    hospitalId: 'H-A',
    type: 'lab_report',
    title: 'Blood report: HbA1c, fasting glucose, LDL',
    date: '2026-03-12',
    summary: 'HbA1c 7.8%. Fasting glucose 142 mg/dL. LDL cholesterol within the reference range.',
    labs: [
      { name: 'HbA1c', value: 7.8, unit: '%', refLow: 4.0, refHigh: 5.6 },
      { name: 'Fasting glucose', value: 142, unit: 'mg/dL', refLow: 70, refHigh: 99 },
      { name: 'LDL cholesterol', value: 98, unit: 'mg/dL', refLow: 0, refHigh: 100 },
    ],
    provenance: { extraction: 'OCR + manual review', verification: 'reviewed', uploadedAt: '2026-03-12T11:20:00', fileName: 'blood_report_mar2026.pdf' },
  },
  {
    id: 'Prescription-A-002',
    patientId: 'MB-PAT-1001',
    hospitalId: 'H-A',
    type: 'prescription',
    title: 'Prescription: Metformin',
    date: '2026-03-12',
    summary: 'Metformin 500 mg twice daily after meals. Review after three months.',
    medications: [{ name: 'Metformin', dose: '500 mg', frequency: 'twice daily after meals' }],
    provenance: { extraction: 'OCR + manual review', verification: 'reviewed', uploadedAt: '2026-03-12T11:42:00', fileName: 'prescription_a_002.pdf' },
  },
  {
    id: 'Dx-A-003',
    patientId: 'MB-PAT-1001',
    hospitalId: 'H-A',
    type: 'diagnosis',
    title: 'Type 2 diabetes mellitus',
    date: '2026-03-12',
    summary: 'Diagnosed after raised fasting glucose and HbA1c. Diet and exercise counselling given.',
    provenance: { extraction: 'Manual entry', verification: 'reviewed', uploadedAt: '2026-03-12T12:05:00', fileName: 'entered in Hospital A system' },
  },
  {
    id: 'Allergy-A-004',
    patientId: 'MB-PAT-1001',
    hospitalId: 'H-A',
    type: 'allergy',
    title: 'Penicillin allergy',
    date: '2026-04-18',
    summary: 'Skin rash after an amoxicillin course, reported by the patient. Severity recorded as mild.',
    provenance: { extraction: 'Manual entry', verification: 'reviewed', uploadedAt: '2026-04-18T09:30:00', fileName: 'entered in Hospital A system' },
  },
  {
    id: 'Report-B-004',
    patientId: 'MB-PAT-1001',
    hospitalId: 'H-B',
    type: 'lab_report',
    title: 'Follow-up blood report',
    date: '2026-06-20',
    summary: 'HbA1c 7.2%. Fasting glucose 128 mg/dL.',
    labs: [
      { name: 'HbA1c', value: 7.2, unit: '%', refLow: 4.0, refHigh: 5.6 },
      { name: 'Fasting glucose', value: 128, unit: 'mg/dL', refLow: 70, refHigh: 99 },
    ],
    provenance: { extraction: 'Structured upload', verification: 'reviewed', uploadedAt: '2026-06-20T15:10:00', fileName: 'lab_feed_b_004.json' },
  },
  {
    id: 'Visit-B-005',
    patientId: 'MB-PAT-1001',
    hospitalId: 'H-B',
    type: 'encounter',
    title: 'Outpatient visit: tiredness and increased thirst',
    date: '2026-10-04',
    summary: 'Tired for two weeks, drinking more water than usual. Patient reports no regular medications. BP 128/82.',
    reportsNoMedication: true,
    provenance: { extraction: 'Manual entry', verification: 'pending', uploadedAt: '2026-10-04T10:14:00', fileName: 'entered in Hospital B system' },
  },
  {
    id: 'Visit-B-101',
    patientId: 'MB-PAT-1002',
    hospitalId: 'H-B',
    type: 'encounter',
    title: 'Outpatient visit: seasonal allergic rhinitis',
    date: '2026-09-10',
    summary: 'Sneezing and itchy eyes for a week. Advised antihistamine as needed.',
    provenance: { extraction: 'Manual entry', verification: 'reviewed', uploadedAt: '2026-09-10T17:00:00', fileName: 'entered in Hospital B system' },
  },
  {
    id: 'Report-B-102',
    patientId: 'MB-PAT-1002',
    hospitalId: 'H-B',
    type: 'lab_report',
    title: 'Complete blood count',
    date: '2026-09-10',
    summary: 'Haemoglobin and white cell count within reference ranges.',
    labs: [{ name: 'Haemoglobin', value: 12.8, unit: 'g/dL', refLow: 12, refHigh: 15.5 }],
    provenance: { extraction: 'OCR + manual review', verification: 'reviewed', uploadedAt: '2026-09-10T17:20:00', fileName: 'cbc_sep2026.pdf' },
  },
];

export const seedConsents = (): Consent[] => [
  {
    id: 'C-0001',
    patientId: 'MB-PAT-1001',
    doctorId: 'D-B-01',
    doctorName: 'Dr. Meera Iyer',
    hospitalId: 'H-B',
    scope: ['lab_report'],
    reason: 'Reviewing diabetes follow-up results.',
    kind: 'standard',
    status: 'active',
    requestedAt: '2026-06-24T09:02:00',
    decidedAt: '2026-06-24T09:40:00',
    expiresAt: '2026-07-01T09:40:00',
  },
];

export const seedAudit = (): AuditEvent[] => [
  { id: 'A-006', at: '2026-06-24T09:50:00', actorId: 'D-B-01', actorName: 'Dr. Meera Iyer', actorHospitalId: 'H-B', patientId: 'MB-PAT-1001', action: 'view_records', resource: 'Report-A-001', consent: 'Active (C-0001)' },
  { id: 'A-005', at: '2026-06-24T09:40:00', actorId: 'U-PAT-1', actorName: 'Rahul Sharma', patientId: 'MB-PAT-1001', action: 'consent_granted', resource: 'C-0001', reason: 'Lab reports for 7 days', consent: 'Granted' },
  { id: 'A-004', at: '2026-06-24T09:02:00', actorId: 'D-B-01', actorName: 'Dr. Meera Iyer', actorHospitalId: 'H-B', patientId: 'MB-PAT-1001', action: 'consent_requested', resource: 'C-0001', reason: 'Reviewing diabetes follow-up results.', consent: 'Pending' },
  { id: 'A-003', at: '2026-06-20T15:10:00', actorId: 'AD-B-01', actorName: 'Sonal Gupta', actorHospitalId: 'H-B', patientId: 'MB-PAT-1001', action: 'record_upload', resource: 'Report-B-004', consent: 'Not required (own hospital)' },
  { id: 'A-002', at: '2026-04-18T09:30:00', actorId: 'AD-A-01', actorName: 'Anil Verma', actorHospitalId: 'H-A', patientId: 'MB-PAT-1001', action: 'record_upload', resource: 'Allergy-A-004', consent: 'Not required (own hospital)' },
  { id: 'A-001', at: '2026-03-12T11:42:00', actorId: 'AD-A-01', actorName: 'Anil Verma', actorHospitalId: 'H-A', patientId: 'MB-PAT-1001', action: 'record_upload', resource: 'Prescription-A-002', consent: 'Not required (own hospital)' },
];
