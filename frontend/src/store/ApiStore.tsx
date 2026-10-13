import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AuditEvent, Consent, MedicalRecord, RecordType, User } from '../types';
import { PATIENTS } from '../data/seed';
import { LOCKED_PREFIX } from '../lib/access';
import * as api from '../lib/api';

/**
 * Store backed by the real FastAPI backend. It exposes the same members as the
 * mock store, so the pages do not change.
 * - The backend decides what each user may read and writes the audit trail.
 * - "Locked" records arrive as counts only; they become content-free placeholders here.
 */

interface State {
  user: User | null;
  records: MedicalRecord[];
  consents: Consent[];
  audit: AuditEvent[];
  ready: boolean;
}

const EMPTY = { records: [] as MedicalRecord[], consents: [] as Consent[], audit: [] as AuditEvent[] };

export interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
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

function lockedPlaceholders(patientId: string, locked: api.RecordList['locked']): MedicalRecord[] {
  return locked.flatMap((l) =>
    Array.from({ length: l.count }, (_, i) => ({
      id: `${LOCKED_PREFIX}${l.hospitalId}:${patientId}:${i}`,
      patientId,
      hospitalId: l.hospitalId,
      type: 'encounter' as RecordType,
      title: 'Locked until the patient gives permission',
      date: '1970-01-01',
      summary: '',
      provenance: { extraction: 'Manual entry' as const, verification: 'unverified' as const, uploadedAt: '1970-01-01T00:00:00', fileName: '' },
    })),
  );
}

async function fetchAll(user: User) {
  const ids = user.role === 'patient' ? (user.patientId ? [user.patientId] : []) : PATIENTS.map((p) => p.id);

  const lists = await Promise.all(
    ids.map(async (id) => {
      try {
        return { id, data: await api.getRecords(id) };
      } catch (e) {
        if (e instanceof api.ApiError && e.status === 401) throw e;
        return null; // e.g. patient not found: skip it
      }
    }),
  );

  const records: MedicalRecord[] = [];
  for (const l of lists) {
    if (l) records.push(...l.data.records, ...lockedPlaceholders(l.id, l.data.locked));
  }

  const [consents, audit] = await Promise.all([
    user.role === 'hospital_admin' ? Promise.resolve([] as api.ApiConsent[]) : api.myConsents(),
    api.getAudit(),
  ]);
  return { records, consents: consents as Consent[], audit };
}

const consentSignature = (list: { id: string; status: string; scope: string[] }[], view?: string[]) =>
  JSON.stringify(list.map((c, i) => [c.id, c.status, c.scope, view?.[i]]));

const Ctx = createContext<Store | null>(null);
const AuthCtx = createContext<AuthActions | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ user: null, ...EMPTY, ready: !api.getToken() });
  const [toast, setToast] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const fail = useCallback((e: unknown) => {
    if (e instanceof api.ApiError && e.status === 401) {
      setState({ user: null, ...EMPTY, ready: true });
      setToast('Your session has ended. Please sign in again.');
      return;
    }
    setToast(e instanceof Error ? e.message : 'Something went wrong.');
  }, []);

  const reload = useCallback(async () => {
    const user = stateRef.current.user;
    if (!user) return;
    try {
      const data = await fetchAll(user);
      setState((s) => (s.user?.id === user.id ? { ...s, ...data } : s));
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  // Restore the session after a page refresh.
  useEffect(() => {
    if (!api.getToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const user = await api.getMe();
        const data = await fetchAll(user);
        if (!cancelled) setState({ user, ...data, ready: true });
      } catch {
        api.logout();
        if (!cancelled) setState({ user: null, ...EMPTY, ready: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Light polling: when a consent changes elsewhere (e.g. the patient grants access), refresh.
  const userKey = state.user ? `${state.user.id}:${state.user.role}` : '';
  useEffect(() => {
    const role = stateRef.current.user?.role;
    if (!role || role === 'hospital_admin') return;
    const timer = window.setInterval(async () => {
      try {
        const next = await api.myConsents();
        const current = stateRef.current.consents;
        const same =
          consentSignature(next, next.map((c) => c.view)) ===
          consentSignature(current, current.map((c) => (c as api.ApiConsent).view));
        if (!same) await reload();
      } catch {
        /* ignore transient errors while polling */
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [userKey, reload]);

  const act = useCallback(
    (fn: () => Promise<unknown>) => {
      void (async () => {
        try {
          await fn();
          await reload();
        } catch (e) {
          fail(e);
        }
      })();
    },
    [reload, fail],
  );

  const signIn: AuthActions['signIn'] = useCallback(async (email, password) => {
    const user = await api.login(email.trim().toLowerCase(), password);
    const data = await fetchAll(user);
    setState({ user, ...data, ready: true });
  }, []);

  const signUp: AuthActions['signUp'] = useCallback(
    async (fullName, email, password) => {
      await api.register({ fullName, email: email.trim().toLowerCase(), password });
      await signIn(email, password);
    },
    [signIn],
  );

  const logout = useCallback(() => {
    api.logout();
    setState({ user: null, ...EMPTY, ready: true });
  }, []);

  const resetDemo = useCallback(() => {
    void (async () => {
      try {
        await api.resetDemo();
        try {
          const user = await api.getMe();
          const data = await fetchAll(user);
          setState({ user, ...data, ready: true });
          setToast('Demo data has been reset.');
        } catch {
          logout();
          setToast('Demo data was reset. Please sign in again.');
        }
      } catch (e) {
        if (e instanceof api.ApiError && e.status === 404) setToast('Reset is available only in development mode.');
        else fail(e);
      }
    })();
  }, [fail, logout]);

  const value = useMemo<Store>(
    () => ({
      ...state,
      login: () => setToast('Please use the sign-in form.'),
      logout,
      resetDemo,
      requestConsent: (_doctor, patientId, scope, reason) =>
        act(() => api.requestConsent(patientId, scope, reason)),
      respondToConsent: (id, grant, opts) =>
        act(() => (grant ? api.grantConsent(id, opts?.days ?? 7, opts?.scope) : api.rejectConsent(id))),
      revokeConsent: (id) => act(() => api.revokeConsent(id)),
      emergencyAccess: (_doctor, patientId, reason) => act(() => api.emergencyAccess(patientId, reason)),
      // The backend already records views and denials on every read, so these two do nothing here.
      logView: () => undefined,
      logDenied: () => undefined,
      logAi: (_viewer, patientId, query) => act(() => api.logAiUse(patientId, query)),
      addRecord: (_admin, record) => {
        act(() =>
          api.uploadRecord({
            patientId: record.patientId,
            type: record.type,
            title: record.title,
            date: record.date.slice(0, 10),
            summary: record.summary,
            labs: record.labs,
            medications: record.medications,
            reportsNoMedication: record.reportsNoMedication,
            extraction: record.provenance.extraction,
            verification: record.provenance.verification,
            fileName: record.provenance.fileName,
          }),
        );
        return 'Saving...'; // the real id is assigned by the backend
      },
    }),
    [state, act, logout, resetDemo],
  );

  const auth = useMemo<AuthActions>(() => ({ signIn, signUp }), [signIn, signUp]);

  return (
    <AuthCtx.Provider value={auth}>
      <Ctx.Provider value={value}>
        {children}
        {toast && (
          <div
            role="alert"
            className="fixed bottom-4 right-4 z-50 max-w-sm rounded-md bg-bad-tint px-4 py-3 text-sm text-bad shadow-lg"
          >
            {toast}
          </div>
        )}
      </Ctx.Provider>
    </AuthCtx.Provider>
  );
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside AppStoreProvider');
  return v;
}
export const useReady = () => useStore().ready;
export const useAuthActions = () => useContext(AuthCtx);