import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@/app/ProtectedRoute';
import { RoleGate } from '@/app/RoleGate';
import { AuthLayout } from '@/layouts/AuthLayout';
import { PortalLayout } from '@/layouts/PortalLayout';

const SignIn = lazy(async () => ({ default: (await import('@/shared/auth/SignIn')).SignIn }));
const SignUp = lazy(async () => ({ default: (await import('@/shared/auth/SignUp')).SignUp }));
const ForgotPassword = lazy(async () => ({
  default: (await import('@/shared/auth/ForgotPassword')).ForgotPassword,
}));
const ResetPassword = lazy(async () => ({
  default: (await import('@/shared/auth/ResetPassword')).ResetPassword,
}));
const VerifyEmail = lazy(async () => ({
  default: (await import('@/shared/auth/VerifyEmail')).VerifyEmail,
}));
const Unlinked = lazy(async () => ({ default: (await import('@/shared/auth/Unlinked')).Unlinked }));
const Forbidden = lazy(async () => ({
  default: (await import('@/shared/errors/Forbidden')).Forbidden,
}));
const NotFound = lazy(async () => ({
  default: (await import('@/shared/errors/NotFound')).NotFound,
}));
const Landing = lazy(async () => ({ default: (await import('@/website/landing/Landing')).Landing }));
const TeamPage = lazy(async () => ({
  default: (await import('@/website/landing/TeamPage')).TeamPage,
}));
const DesktopDownload = lazy(async () => ({
  default: (await import('@/shared/shell/DesktopDownload')).DesktopDownload,
}));
const StaffDesktopRequired = lazy(async () => ({
  default: (await import('@/shared/shell/DesktopRequired')).StaffDesktopRequired,
}));

const PortalOverview = lazy(async () => ({
  default: (await import('@/website/portal/PortalOverview')).PortalOverview,
}));
const PortalCompliance = lazy(async () => ({
  default: (await import('@/website/portal/PortalCompliance')).PortalCompliance,
}));
const PortalDocuments = lazy(async () => ({
  default: (await import('@/website/portal/PortalDocuments')).PortalDocuments,
}));
const PortalRequests = lazy(async () => ({
  default: (await import('@/website/portal/PortalRequests')).PortalRequests,
}));
const PortalTasks = lazy(async () => ({
  default: (await import('@/website/portal/PortalTasks')).PortalTasks,
}));
const PortalMessages = lazy(async () => ({
  default: (await import('@/website/portal/PortalMessages')).PortalMessages,
}));
const PortalProfile = lazy(async () => ({
  default: (await import('@/website/portal/PortalProfile')).PortalProfile,
}));

export function WebRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/portal/sign-in" element={<Navigate to="/sign-in?portal=client" replace />} />
        <Route path="/client/sign-in" element={<Navigate to="/sign-in?portal=client" replace />} />
        <Route path="/admin/sign-in" element={<Navigate to="/desktop-required" replace />} />
        <Route path="/staff/sign-in" element={<Navigate to="/desktop-required" replace />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/unlinked" element={<Unlinked />} />
        <Route path="/403" element={<Forbidden />} />
        <Route path="/404" element={<NotFound />} />
      </Route>

      <Route path="/desktop-download" element={<DesktopDownload />} />
      <Route path="/desktop-required" element={<StaffDesktopRequired />} />

      <Route
        element={
          <ProtectedRoute>
            <RoleGate roles={['client']} fallback="home">
              <PortalLayout />
            </RoleGate>
          </ProtectedRoute>
        }
      >
        <Route path="/portal" element={<PortalOverview />} />
        <Route path="/portal/compliance" element={<PortalCompliance />} />
        <Route path="/portal/documents" element={<PortalDocuments />} />
        <Route path="/portal/requests" element={<PortalRequests />} />
        <Route path="/portal/tasks" element={<PortalTasks />} />
        <Route path="/portal/messages" element={<PortalMessages />} />
        <Route path="/portal/profile" element={<PortalProfile />} />
      </Route>

      {/* Legacy workspace links are never served on the website. */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <RoleGate roles={['admin', 'staff']} fallback="home">
              <StaffDesktopRequired />
            </RoleGate>
          </ProtectedRoute>
        }
      />

      <Route path="/team" element={<TeamPage />} />
      <Route path="/" element={<Landing />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}

export const ShellRoutes = WebRoutes;
