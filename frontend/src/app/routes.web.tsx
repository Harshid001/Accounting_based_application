import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { RoleGate } from '@/app/RoleGate';
import { ProtectedRoute } from '@/app/ProtectedRoute';
import { AuthLayout } from '@/layouts/AuthLayout';
import { PortalLayout } from '@/layouts/PortalLayout';

const SignIn = lazy(async () => ({ default: (await import('@/routes/auth/SignIn')).SignIn }));
const SignUp = lazy(async () => ({ default: (await import('@/routes/auth/SignUp')).SignUp }));
const ForgotPassword = lazy(async () => ({
  default: (await import('@/routes/auth/ForgotPassword')).ForgotPassword,
}));
const ResetPassword = lazy(async () => ({
  default: (await import('@/routes/auth/ResetPassword')).ResetPassword,
}));
const VerifyEmail = lazy(async () => ({
  default: (await import('@/routes/auth/VerifyEmail')).VerifyEmail,
}));
const Unlinked = lazy(async () => ({ default: (await import('@/routes/auth/Unlinked')).Unlinked }));
const Forbidden = lazy(async () => ({
  default: (await import('@/routes/errors/Forbidden')).Forbidden,
}));
const NotFound = lazy(async () => ({
  default: (await import('@/routes/errors/NotFound')).NotFound,
}));
const Landing = lazy(async () => ({ default: (await import('@/routes/landing/Landing')).Landing }));
const TeamPage = lazy(async () => ({
  default: (await import('@/routes/landing/TeamPage')).TeamPage,
}));
const StaffDesktopRequired = lazy(async () => ({
  default: (await import('@/routes/shell/DesktopRequired')).StaffDesktopRequired,
}));
const DesktopDownload = lazy(async () => ({
  default: (await import('@/routes/shell/DesktopDownload')).DesktopDownload,
}));

const PortalOverview = lazy(async () => ({
  default: (await import('@/routes/portal/PortalOverview')).PortalOverview,
}));
const PortalCompliance = lazy(async () => ({
  default: (await import('@/routes/portal/PortalCompliance')).PortalCompliance,
}));
const PortalDocuments = lazy(async () => ({
  default: (await import('@/routes/portal/PortalDocuments')).PortalDocuments,
}));
const PortalRequests = lazy(async () => ({
  default: (await import('@/routes/portal/PortalRequests')).PortalRequests,
}));
const PortalTasks = lazy(async () => ({
  default: (await import('@/routes/portal/PortalTasks')).PortalTasks,
}));
const PortalMessages = lazy(async () => ({
  default: (await import('@/routes/portal/PortalMessages')).PortalMessages,
}));
const PortalProfile = lazy(async () => ({
  default: (await import('@/routes/portal/PortalProfile')).PortalProfile,
}));

/**
 * Web shell route table: landing, auth (client tab), and /portal/* only.
 * Staff/admin routes never exist in this table; the compiled bundle
 * contains zero staff route code (D1 exit criteria).
 *
 * The VITE_WEB_STAFF_ACCESS escape hatch (off by default) is enforced at
 * BUILD time, not runtime: if it is ever explicitly decided to re-enable
 * staff access on web, produce that build from app/routes.desktop.tsx
 * with VITE_WEB_STAFF_ACCESS=true — the default web build tree-shakes
 * nothing staff-related in because there is no import path to it at all.
 */
const STAFF_ROUTES_DISABLED = true;

export function WebRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/portal/sign-in" element={<Navigate to="/sign-in?portal=client" replace />} />
        <Route path="/admin/sign-in" element={<Navigate to="/sign-in?portal=admin" replace />} />
        <Route path="/client/sign-in" element={<Navigate to="/sign-in?portal=client" replace />} />
        <Route path="/staff/sign-in" element={<Navigate to="/sign-in?portal=admin" replace />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/unlinked" element={<Unlinked />} />
        <Route path="/403" element={<Forbidden />} />
        <Route path="/404" element={<NotFound />} />
      </Route>

      <Route path="/desktop-required" element={<StaffDesktopRequired />} />
      {/* The download page the interstitial links to — never 404s by default. */}
      <Route path="/desktop-download" element={<DesktopDownload />} />

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

      <Route path="/team" element={<TeamPage />} />
      <Route path="/" element={<Landing />} />

      {STAFF_ROUTES_DISABLED ? (
        <>
          {/* Split-surface rule: every staff/admin path (dashboard, clients,
              books, tasks, compliance, automation, settings, …) lands on the
              desktop-required interstitial instead of the workspace. */}
          <Route path="/dashboard" element={<StaffDesktopRequired />} />
          <Route path="/clients/*" element={<StaffDesktopRequired />} />
          <Route path="/tasks/*" element={<StaffDesktopRequired />} />
          <Route path="/compliance/*" element={<StaffDesktopRequired />} />
          <Route path="/books/*" element={<StaffDesktopRequired />} />
          <Route path="/settings/*" element={<StaffDesktopRequired />} />
          <Route path="/automation" element={<StaffDesktopRequired />} />
          <Route path="/documents" element={<StaffDesktopRequired />} />
          <Route path="/converter" element={<StaffDesktopRequired />} />
          <Route path="/requests" element={<StaffDesktopRequired />} />
          <Route path="/messages" element={<StaffDesktopRequired />} />
          <Route path="/reports/*" element={<StaffDesktopRequired />} />
          <Route path="/notifications" element={<StaffDesktopRequired />} />
          <Route path="/my-work" element={<StaffDesktopRequired />} />
          <Route path="/profile" element={<StaffDesktopRequired />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </>
      ) : null}
    </Routes>
  );
}

/** Alias target: @/app/routes.shell resolves here in web builds. */
export const ShellRoutes = WebRoutes;
