import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { GuestOnly, PageLoader, RequireRole } from './components/RouteGuards';
import { PublicLayout } from './features/student/PublicLayout';
import { CandidatesShowcasePage } from './pages/CandidatesShowcasePage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ResultsPublicPage } from './pages/ResultsPublicPage';
import { VoteSuccessPage } from './pages/VoteSuccessPage';

// Panel panitia (termasuk Recharts) dimuat terpisah agar halaman siswa tetap ringan di ponsel.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const OverviewPage = lazy(() => import('./pages/admin/OverviewPage'));
const MonitoringPage = lazy(() => import('./pages/admin/MonitoringPage'));
const CandidatesPage = lazy(() => import('./pages/admin/CandidatesPage'));
const CategoriesPage = lazy(() => import('./pages/admin/CategoriesPage'));
const StudentsPage = lazy(() => import('./pages/admin/StudentsPage'));
const TeachersPage = lazy(() => import('./pages/admin/TeachersPage'));
const ClassesPage = lazy(() => import('./pages/admin/ClassesPage'));
const SchedulePage = lazy(() => import('./pages/admin/SchedulePage'));
const ResultsPage = lazy(() => import('./pages/admin/ResultsPage'));
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const BackupPage = lazy(() => import('./pages/admin/BackupPage'));

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
      {/* Halaman publik: bisa dilihat tanpa login; login hanya diperlukan saat memilih. */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/kandidat" element={<CandidatesShowcasePage />} />
        <Route path="/terpilih" element={<ResultsPublicPage />} />
      </Route>
      <Route
        path="/voting/berhasil"
        element={
          <RequireRole roles={['student', 'teacher']}>
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
        <Route path="kategori" element={<CategoriesPage />} />
        <Route path="kandidat" element={<CandidatesPage />} />
        <Route path="siswa" element={<StudentsPage />} />
        <Route path="guru" element={<TeachersPage />} />
        <Route path="kelas" element={<ClassesPage />} />
        <Route path="jadwal" element={<SchedulePage />} />
        <Route path="hasil" element={<ResultsPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="pengaturan" element={<SettingsPage />} />
        <Route path="cadangan" element={<BackupPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}
