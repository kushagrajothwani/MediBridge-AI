import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuditAction, AuditEvent, Consent, MedicalRecord, RecordType, User } from '../types';
import { seedAudit, seedConsents, seedRecords, USERS } from '../data/seed';
import { consentState, isActive } from '../lib/access';

/**
 * Demo store. Everything lives in the browser so the frontend can be shown
 * without the backend. Each action below maps to one FastAPI endpoint
 * (see README, "Connecting the backend").
 */

interface State {
  user: User | null;
  records: MedicalRecord[];
  consents: Consent[];
  audit: AuditEvent[];
}

const KEY = 'medibridge-demo-v1';
const fresh = (): State => ({ user: null, records: seedRecords(), consents: seedConsents(), audit: seedAudit() });

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    /* storage unavailable or corrupted: start fresh */
  }
  return fresh();
}

let counter = Date.now();
const nextId = (prefix: string) => `${prefix}-${(counter++).toString(36)}`;

function withAudit(
  s: State,
  actor: User,
  patientId: string,
  action: AuditAction,
  resource: string,
  consent: string,
  reason?: string,
): State {
  const nowMs = Date.now();
  // Ignore an identical event repeated within 3 seconds (page re-renders).
  const dup = s.audit.find(
    (e) =>
      e.actorId === actor.id && e.patientId === patientId && e.action === action && e.resource === resource &&
      nowMs - new Date(e.at).getTime() < 3000,
  );
  if (dup) return s;
  const event: AuditEvent = {
    id: nextId('A'),
    at: new Date(nowMs).toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    actorHospitalId: actor.hospitalId,
    patientId,
    action,
    resource,
    reason,
    consent,
  };
  return { ...s, audit: [event, ...s.audit] };
}

interface Store extends State {
  login: (userId: string) => void;
  logout: () => void;
  resetDemo: () => void;
  requestConsent: (doctor: User, patientId: string, scope: RecordType[], reason: string) => void;
  respondToConsent: (id: string, grant: boolean, opts?: { scope?: RecordType[]; days?: number }) => void;
  revokeConsent: (id: string) => void;
  emergencyAccess: (doctor: User, patientId: string, reason: string) => void;
  logView: (viewer: User, patientId: string) => void;
  logDenied: (viewer: User, record: MedicalRecord) => void;
  logAi: (viewer: User, patientId: string, query: string) => void;
  addRecord: (admin: User, record: Omit<MedicalRecord, 'id'>) => string;
}

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const login = useCallback((userId: string) => {
    const user = USERS.find((u) => u.id === userId) ?? null;
    setState((s) => ({ ...s, user }));
  }, []);
  const logout = useCallback(() => setState((s) => ({ ...s, user: null })), []);
  const resetDemo = useCallback(() => setState((s) => ({ ...fresh(), user: s.user })), []);

  const requestConsent: Store['requestConsent'] = useCallback((doctor, patientId, scope, reason) => {
    setState((s) => {
      const c: Consent = {
        id: nextId('C'),
        patientId,
        doctorId: doctor.id,
        doctorName: doctor.name,
        hospitalId: doctor.hospitalId ?? '',
        scope,
        reason,
        kind: 'standard',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };
      return withAudit({ ...s, consents: [c, ...s.consents] }, doctor, patientId, 'consent_requested', c.id, 'Pending', reason);
    });
  }, []);

  const respondToConsent: Store['respondToConsent'] = useCallback((id, grant, opts) => {
    setState((s) => {
      const c = s.consents.find((x) => x.id === id);
      if (!c || !s.user) return s;
      const now = new Date();
      const updated: Consent = grant
        ? {
            ...c,
            status: 'active',
            scope: opts?.scope?.length ? opts.scope : c.scope,
            decidedAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + (opts?.days ?? 7) * 86_400_000).toISOString(),
          }
        : { ...c, status: 'rejected', decidedAt: now.toISOString() };
      const next = { ...s, consents: s.consents.map((x) => (x.id === id ? updated : x)) };
      return withAudit(
        next, s.user, c.patientId, grant ? 'consent_granted' : 'consent_rejected', c.id,
        grant ? 'Granted' : 'Declined',
        grant ? `${updated.scope.length} record type(s) for ${opts?.days ?? 7} day(s)` : undefined,
      );
    });
  }, []);

  const revokeConsent: Store['revokeConsent'] = useCallback((id) => {
    setState((s) => {
      const c = s.consents.find((x) => x.id === id);
      if (!c || !s.user) return s;
      const next = {
        ...s,
        consents: s.consents.map((x) => (x.id === id ? { ...x, status: 'revoked' as const, decidedAt: new Date().toISOString() } : x)),
      };
      return withAudit(next, s.user, c.patientId, 'consent_revoked', c.id, 'Revoked');
    });
  }, []);

  const emergencyAccess: Store['emergencyAccess'] = useCallback((doctor, patientId, reason) => {
    setState((s) => {
      const now = new Date();
      const c: Consent = {
        id: nextId('C'),
        patientId,
        doctorId: doctor.id,
        doctorName: doctor.name,
        hospitalId: doctor.hospitalId ?? '',
        // Emergency access is narrow on purpose: no visit notes, no discharge summaries.
        scope: ['allergy', 'diagnosis', 'prescription'],
        reason,
        kind: 'emergency',
        status: 'active',
        requestedAt: now.toISOString(),
        decidedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 24 * 3_600_000).toISOString(),
      };
      return withAudit({ ...s, consents: [c, ...s.consents] }, doctor, patientId, 'emergency_access', c.id, 'Emergency (24 hours)', reason);
    });
  }, []);

  const logView: Store['logView'] = useCallback((viewer, patientId) => {
    setState((s) => {
      const live = s.consents.find((c) => c.patientId === patientId && c.doctorId === viewer.id && isActive(c));
      const label = viewer.role === 'patient' ? 'Own records' : live ? `Active (${live.id})` : 'Own hospital only';
      return withAudit(s, viewer, patientId, 'view_records', patientId, label);
    });
  }, []);

  const logDenied: Store['logDenied'] = useCallback((viewer, record) => {
    setState((s) => withAudit(s, viewer, record.patientId, 'access_denied', record.id, 'None'));
  }, []);

  const logAi: Store['logAi'] = useCallback((viewer, patientId, query) => {
    setState((s) => withAudit(s, viewer, patientId, 'ai_summary', 'AI assistant', 'Checked per record', query));
  }, []);

  const addRecord: Store['addRecord'] = useCallback((admin, record) => {
    const id = `${record.type === 'lab_report' ? 'Report' : 'Doc'}-${record.hospitalId.slice(-1)}-${String(Math.floor(Math.random() * 900) + 100)}`;
    setState((s) =>
      withAudit(
        { ...s, records: [{ ...record, id }, ...s.records] },
        admin, record.patientId, 'record_upload', id, 'Not required (own hospital)',
      ),
    );
    return id;
  }, []);

  const value = useMemo<Store>(
    () => ({
      ...state, login, logout, resetDemo, requestConsent, respondToConsent, revokeConsent,
      emergencyAccess, logView, logDenied, logAi, addRecord,
    }),
    [state, login, logout, resetDemo, requestConsent, respondToConsent, revokeConsent, emergencyAccess, logView, logDenied, logAi, addRecord],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside AppStoreProvider');
  return v;
}

export { consentState };
