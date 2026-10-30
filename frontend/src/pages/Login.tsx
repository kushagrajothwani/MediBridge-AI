import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Stethoscope, User as UserIcon, Building2 } from 'lucide-react';
import { Wordmark } from '../components/Logo';
import { Button, Field, inputClass } from '../components/ui';
import { HOSPITALS, USERS } from '../data/seed';
import { USE_API } from '../lib/api';
import { useAuthActions, useStore } from '../store/AppStore';
import type { Role } from '../types';

const SHOW_DEMO = import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true';

const ROLES: { id: Role; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'patient', label: 'Patient', hint: 'See your records and decide who can read them', icon: <UserIcon className="size-5" /> },
  { id: 'doctor', label: 'Doctor', hint: 'Search patients and ask the AI assistant', icon: <Stethoscope className="size-5" /> },
  { id: 'hospital_admin', label: 'Hospital admin', hint: "Upload and review your hospital's records", icon: <Building2 className="size-5" /> },
];

// Synthetic demo accounts (created by the seed script). Shown only when VITE_SHOW_DEMO_ACCOUNTS=true.
const DEMO: Record<string, { email: string; password: string }> = {
  patient: { email: 'rahul@example.com', password: 'Rahul12345' },
  'doctor:H-A': { email: 'arjun@example.com', password: 'Arjun12345' },
  'doctor:H-B': { email: 'meera@example.com', password: 'Meera12345' },
  'hospital_admin:H-A': { email: 'admin.a@example.com', password: 'Admin12345' },
  'hospital_admin:H-B': { email: 'admin.b@example.com', password: 'Admin12345' },
};
const demoFor = (role: Role, hospital: string) => DEMO[role === 'patient' ? 'patient' : `${role}:${hospital}`];

export default function Login() {
  const { login } = useStore();
  const auth = useAuthActions();
  const nav = useNavigate();

  const prefill = USE_API && SHOW_DEMO ? demoFor('doctor', 'H-B') : undefined;
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [role, setRole] = useState<Role>('doctor');
  const [hospital, setHospital] = useState('H-B');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(prefill?.email ?? (USE_API ? '' : 'demo@medibridge.test'));
  const [password, setPassword] = useState(prefill?.password ?? (USE_API ? '' : 'demo1234'));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // The role cards act as a demo-account picker. With the real backend they are shown only in demo mode.
  const showPicker = !USE_API || (mode === 'signin' && SHOW_DEMO);
  const needsHospital = showPicker && role !== 'patient';

  function choose(nextRole: Role, nextHospital: string) {
    setRole(nextRole);
    setHospital(nextHospital);
    const demo = USE_API && SHOW_DEMO && mode === 'signin' ? demoFor(nextRole, nextHospital) : undefined;
    if (demo) {
      setEmail(demo.email);
      setPassword(demo.password);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (mode === 'register' && name.trim().length < 2) next.name = 'Enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter an email address like name@example.com.';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      if (USE_API && auth) {
        if (mode === 'register') await auth.signUp(name.trim(), email, password);
        else await auth.signIn(email, password);
        nav('/app');
      } else {
        const user = USERS.find((u) => u.role === role && (role === 'patient' || u.hospitalId === hospital));
        if (!user) {
          setErrors({ form: 'No demo account for that role and hospital. Pick another hospital.' });
          return;
        }
        login(user.id);
        nav('/app');
      }
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  const signinHelp = USE_API
    ? SHOW_DEMO
      ? 'Pick a demo account below, or type your own email and password.'
      : 'Sign in with your email and password.'
    : 'Choose a role to see the product from that side. Any email and an 8+ character password will work.';
  const registerHelp = USE_API
    ? 'Registration creates a patient account. Doctor and hospital staff accounts are set up by an administrator.'
    : 'In this demo, registering signs you in with the sample account for the role you pick.';

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-navy px-12 py-10 text-white lg:flex">
        <Link to="/">
          <Wordmark light />
        </Link>
        <div className="w-full max-w-lg">
          <p className="font-display text-3xl font-semibold leading-snug">
            A patient arrives unconscious. Her last six months of records are at another hospital.
          </p>
          <p className="mt-5 max-w-md leading-relaxed text-white/70">
                
            MediBridge gives the doctor a way to get them, with the patient's consent on record.
          </p>
        </div>
        <div />
      </aside>

      <main className="flex min-w-0 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <form onSubmit={submit} noValidate className="w-full max-w-md">
          <Link to="/" className="mb-8 block lg:hidden">
            <Wordmark />
          </Link>

          <h1 className="font-display text-3xl font-semibold">
            {mode === 'signin' ? 'Sign in to the demo' : 'Create an account'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{mode === 'signin' ? signinHelp : registerHelp}</p>

          {showPicker && (
            <fieldset className="mt-6">
              <legend className="mb-2 text-sm font-medium">{USE_API ? 'Demo account' : 'I am a'}</legend>
              <div className="grid gap-2">
                {ROLES.map((r) => (
                  <label
                    key={r.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors ${
                      role === r.id ? 'border-brand bg-brand-tint' : 'border-line bg-white hover:bg-paper'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      className="sr-only"
                      checked={role === r.id}
                      onChange={() => choose(r.id, hospital)}
                    />
                    <span className={role === r.id ? 'text-brand-deep' : 'text-muted'}>{r.icon}</span>
                    <span className="min-w-0">
                      <span className="block font-medium">{r.label}</span>
                      <span className="block text-sm text-muted">{r.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-5 space-y-4">
            {needsHospital && (
              <Field label="Hospital" htmlFor="hospital">
                <select
                  id="hospital"
                  value={hospital}
                  onChange={(e) => choose(role, e.target.value)}
                  className={inputClass}
                >
                  {HOSPITALS.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.short})
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {mode === 'register' && (
              <Field label="Full name" htmlFor="name" error={errors.name}>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoComplete="name" />
              </Field>
            )}

            <Field label="Email" htmlFor="email" error={errors.email}>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="email" />
            </Field>

            <Field label="Password" htmlFor="password" error={errors.password}>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </Field>
          </div>

          {errors.form && (
            <p role="alert" className="mt-4 rounded-md bg-bad-tint px-3 py-2 text-sm text-bad">
              {errors.form}
            </p>
          )}

          <Button type="submit" className="mt-6 w-full" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>

          <p className="mt-4 text-center text-sm text-muted">
            {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
            <button
              type="button"
              className="font-medium text-brand-deep underline underline-offset-2"
              onClick={() => {
                setMode(mode === 'signin' ? 'register' : 'signin');
                setErrors({});
              }}
            >
              {mode === 'signin' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}