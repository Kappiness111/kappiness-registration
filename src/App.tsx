import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import PatientFlow from './pages/patient/PatientFlow';

// The staff area (and the Supabase client) is code-split: patients never download it.
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminResetPassword = lazy(() => import('./pages/admin/AdminResetPassword'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const RequireStaff = lazy(() => import('./pages/admin/RequireStaff'));

function Loading() {
  return (
    <div className="flex min-h-svh items-center justify-center" role="status">
      <span className="size-8 animate-spin rounded-full border-2 border-olive border-t-transparent" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<PatientFlow />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/reset-password" element={<AdminResetPassword />} />
          <Route
            path="/admin"
            element={
              <RequireStaff>
                <AdminDashboard />
              </RequireStaff>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
