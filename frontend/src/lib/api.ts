import type { AuditEvent, Consent, ConsentView, MedicalRecord, Patient, RecordType, User } from '../types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';
/** VITE_USE_API=true uses the backend. Anything else uses the built-in mock store. */
export const USE_API = import.meta.env.VITE_USE_API === 'true';
const TOKEN_KEY = 'mb_token';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const logout = () => localStorage.removeItem(TOKEN_KEY);

async function request<T>(
  path: string,
  init: { method?: string; json?: unknown; form?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  if (init.form) body = new URLSearchParams(init.form);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method: init.method ?? (body ? 'POST' : 'GET'), headers, body });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the backend running?');
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const detail = (await res.json()).detail;
      if (typeof detail === 'string') message = detail;
      else if (Array.isArray(detail)) message = detail.map((d: { msg: string }) => d.msg).join(', ');
    } catch {
      /* keep the default message */
    }
    if (res.status === 401 && path !== '/auth/login') logout();
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- Authentication ----------
interface ApiUser {
  id: string;
  full_name: string;
  role: User['role'];
  title?: string | null;
  hospital_code?: string | null;
  mb_patient_id?: string | null;
}

export async function getMe(): Promise<User> {
  const u = await request<ApiUser>('/auth/me');
  return {
    id: u.id,
    name: u.full_name,
    role: u.role,
    title: u.title ?? '',
    hospitalId: u.hospital_code ?? undefined,
    patientId: u.mb_patient_id ?? undefined,
  };
}

export async function login(email: string, password: string): Promise<User> {
  const t = await request<{ access_token: string }>('/auth/login', { form: { username: email, password } });
  localStorage.setItem(TOKEN_KEY, t.access_token);
  return getMe();
}

export const register = (data: { email: string; password: string; fullName: string }) =>
  request<unknown>('/auth/register', {
    json: { email: data.email, password: data.password, full_name: data.fullName, role: 'patient' },
  });

// ---------- Patients and records ----------
export const getMyProfile = () => request<Patient>('/patients/me');
export const searchPatient = (q: string) => request<Patient>(`/patients/search?q=${encodeURIComponent(q)}`);

export interface RecordList {
  records: MedicalRecord[];
  locked: { hospitalId: string; count: number }[];
}
export const getRecords = (patientId: string) =>
  request<RecordList>(`/patients/${encodeURIComponent(patientId)}/records`);
export const getRecord = (id: string) => request<MedicalRecord>(`/records/${encodeURIComponent(id)}`);

export const uploadRecord = (payload: {
  patientId: string; type: RecordType; title: string; date: string; summary: string;
  labs?: MedicalRecord['labs']; medications?: MedicalRecord['medications'];
  reportsNoMedication?: boolean; extraction?: string; verification?: string; fileName?: string;
}) => request<MedicalRecord>('/records', { json: payload });

// ---------- Consent ----------
export type ApiConsent = Consent & { view: ConsentView };

export const requestConsent = (patientId: string, scope: RecordType[], reason: string) =>
  request<ApiConsent>('/consents/request', { json: { patientId, scope, reason } });
export const myConsents = () => request<ApiConsent[]>('/consents/mine');
export const grantConsent = (id: string, durationDays = 7, scope?: RecordType[]) =>
  request<ApiConsent>(`/consents/${id}/grant`, { json: { durationDays, scope } });
export const rejectConsent = (id: string) => request<ApiConsent>(`/consents/${id}/reject`, { method: 'POST' });
export const revokeConsent = (id: string) => request<ApiConsent>(`/consents/${id}/revoke`, { method: 'POST' });
export const emergencyAccess = (patientId: string, reason: string) =>
  request<ApiConsent>('/consents/emergency', { json: { patientId, reason } });

// ---------- Audit and demo ----------
export const getAudit = () => request<AuditEvent[]>('/audit');
export const logAiUse = (patientId: string, query: string) =>
  request<void>('/audit/ai', { json: { patientId, query } });
export const resetDemo = () => request<{ status: string }>('/demo/reset', { method: 'POST' });