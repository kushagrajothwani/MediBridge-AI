import { Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from './store/AppStore';
import Shell from './components/Shell';
import Landing from './pages/Landing';
import Login from './pages/Login';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import HospitalDashboard from './pages/HospitalDashboard';
import PatientProfile from './pages/PatientProfile';
import ConsentPage from './pages/Consent';
import Assistant from './pages/Assistant';
import Interop from './pages/Interop';
import AuditPage from './pages/Audit';
import { ErrorState } from './components/ui';

function RequireAuth() {
  const { user } = useStore();
  return user ? <Shell /> : <Navigate to="/login" replace />;
}

function Home() {
  const { user } = useStore();
  if (user?.role === 'patient') return <PatientDashboard />;
  if (user?.role === 'doctor') return <DoctorDashboard />;
  return <HospitalDashboard />;
}

function DoctorOnly({ children }: { children: React.ReactNode }) {
  const { user } = useStore();
  return user?.role === 'doctor' ? <>{children}</> : <ErrorState title="Doctors only" body="This page is available to signed-in doctors." />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/app" element={<RequireAuth />}>
        <Route index element={<Home />} />
        <Route path="patient/:id" element={<PatientProfile />} />
        <Route path="consent" element={<ConsentPage />} />
        <Route path="assistant" element={<DoctorOnly><Assistant /></DoctorOnly>} />
        <Route path="interop" element={<Interop />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
