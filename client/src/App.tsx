import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { GuestOnly, PageLoader, RequireRole } from './components/RouteGuards';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { VoteSuccessPage } from './pages/VoteSuccessPage';

// Panel panitia (termasuk Recharts) dimuat terpisah agar halaman siswa tetap ringan di ponsel.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const OverviewPage = lazy(() => import('./pages/admin/OverviewPage'));
const MonitoringPage = lazy(() => import('./pages/admin/MonitoringPage'));
const CandidatesPage = lazy(() => import('./pages/admin/CandidatesPage'));
const StudentsPage = lazy(() => import('./pages/admin/StudentsPage'));
const ClassesPage = lazy(() => import('./pages/admin/ClassesPage'));
const SchedulePage = lazy(() => import('./pages/admin/SchedulePage'));
const ResultsPage = lazy(() => import('./pages/admin/ResultsPage'));
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));

export function App() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage variant="student" />
          </GuestOnly>
        }
      />
      <Route
        path="/admin/login"
        element={
          <GuestOnly>
            <LoginPage variant="admin" />
          </GuestOnly>
        }
      />
      <Route
        path="/"
        element={
          <RequireRole roles={['student', 'admin']}>
            <DashboardPage />
          </RequireRole>
        }
      />
      <Route
        path="/voting/berhasil"
        element={
          <RequireRole roles={['student']}>
            <VoteSuccessPage />
          </RequireRole>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireRole roles={['admin']}>
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="monitoring" element={<MonitoringPage />} />
        <Route path="kandidat" element={<CandidatesPage />} />
        <Route path="siswa" element={<StudentsPage />} />
        <Route path="kelas" element={<ClassesPage />} />
        <Route path="jadwal" element={<SchedulePage />} />
        <Route path="hasil" element={<ResultsPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="pengaturan" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}
