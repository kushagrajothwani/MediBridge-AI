import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity, ClipboardList, FileUp, FolderHeart, LayoutDashboard, LogOut, Menu, RotateCcw, ShieldCheck, Sparkles, Users, Workflow, X,
} from 'lucide-react';
import { useStore } from '../store/AppStore';
import { hospitalById } from '../data/seed';
import { Wordmark } from './Logo';
import { initials } from '../lib/format';
import { Button } from './ui';
import type { Role } from '../types';

interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean }

function navFor(role: Role, patientId?: string): NavItem[] {
  const i = 'size-[18px]';
  if (role === 'patient')
    return [
      { to: '/app', label: 'Overview', icon: <LayoutDashboard className={i} />, end: true },
      { to: `/app/patient/${patientId}`, label: 'My records', icon: <FolderHeart className={i} /> },
      { to: '/app/consent', label: 'Who can see my records', icon: <ShieldCheck className={i} /> },
      { to: '/app/audit', label: 'Access history', icon: <ClipboardList className={i} /> },
    ];
  if (role === 'doctor')
    return [
      { to: '/app', label: 'Patients', icon: <Users className={i} />, end: true },
      { to: '/app/assistant', label: 'AI assistant', icon: <Sparkles className={i} /> },
      { to: '/app/consent', label: 'Access requests', icon: <ShieldCheck className={i} /> },
      { to: '/app/interop', label: 'Record exchange', icon: <Workflow className={i} /> },
      { to: '/app/audit', label: 'Audit log', icon: <ClipboardList className={i} /> },
    ];
  return [
    { to: '/app', label: 'Hospital records', icon: <FileUp className={i} />, end: true },
    { to: '/app/interop', label: 'Record exchange', icon: <Workflow className={i} /> },
    { to: '/app/audit', label: 'Audit log', icon: <ClipboardList className={i} /> },
  ];
}

const ROLE_NAME: Record<Role, string> = { patient: 'Patient', doctor: 'Doctor', hospital_admin: 'Hospital admin' };

export default function Shell() {
  const { user, logout, resetDemo } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const hospital = hospitalById(user.hospitalId);
  const items = navFor(user.role, user.patientId);

  const sidebar = (
    <div className="flex h-full flex-col bg-navy text-white">
      <div className="flex h-16 items-center justify-between px-5">
        <Wordmark light />
        <button className="rounded p-1 text-white/70 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>
      <nav className="mt-2 flex-1 space-y-0.5 px-3" aria-label="Main">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] transition-colors ${
                isActive ? 'bg-white/12 font-medium text-white' : 'text-white/70 hover:bg-white/6 hover:text-white'
              }`
            }
          >
            {it.icon}
            {it.label}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 rounded-md bg-white/6 p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-deep text-sm font-semibold">{initials(user.name)}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-white/60">{hospital ? `${ROLE_NAME[user.role]} at ${hospital.short}` : ROLE_NAME[user.role]}</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); nav('/'); }}
          className="mt-3 flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onMouseDown={() => setOpen(false)}>
          <div className="absolute inset-0 bg-navy/50" />
          <div className="relative h-full w-72" onMouseDown={(e) => e.stopPropagation()}>{sidebar}</div>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-8">
          <button className="rounded p-1.5 hover:bg-black/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('Reset all demo data to its starting state?')) resetDemo(); }}>
              <RotateCcw className="size-4" /> Reset demo
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
