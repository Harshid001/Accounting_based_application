import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { HomeRedirect, RoleGate } from '@/app/RoleGate';
import { ProtectedRoute } from '@/app/ProtectedRoute';
import { AuthLayout } from '@/layouts/AuthLayout';
import { PortalLayout } from '@/layouts/PortalLayout';
import { StaffLayout } from '@/layouts/StaffLayout';

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
const NotFound = lazy(async () => ({ default: (await import('@/routes/errors/NotFound')).NotFound }));

const Dashboard = lazy(async () => ({
  default: (await import('@/routes/dashboard/Dashboard')).Dashboard,
}));
const MyWork = lazy(async () => ({ default: (await import('@/routes/my-work/MyWork')).MyWork }));
const ClientList = lazy(async () => ({
  default: (await import('@/routes/clients/ClientList')).ClientList,
}));
const ClientNew = lazy(async () => ({
  default: (await import('@/routes/clients/ClientNew')).ClientNew,
}));
const ClientEdit = lazy(async () => ({
  default: (await import('@/routes/clients/ClientEdit')).ClientEdit,
}));
const ClientRecord = lazy(async () => ({
  default: (await import('@/routes/clients/ClientRecord')).ClientRecord,
}));
const ProfileTab = lazy(async () => ({
  default: (await import('@/routes/clients/tabs/ProfileTab')).ProfileTab,
}));
const DocumentsTab = lazy(async () => ({
  default: (await import('@/routes/clients/tabs/DocumentsTab')).DocumentsTab,
}));
const ComplianceTab = lazy(async () => ({
  default: (await import('@/routes/clients/tabs/ComplianceTab')).ComplianceTab,
}));
const TasksTab = lazy(async () => ({
  default: (await import('@/routes/clients/tabs/TasksTab')).TasksTab,
}));
const RequestsTab = lazy(async () => ({
  default: (await import('@/routes/clients/tabs/RequestsTab')).RequestsTab,
}));
const MessagesTab = lazy(async () => ({
  default: (await import('@/routes/clients/tabs/MessagesTab')).MessagesTab,
}));
const ActivityTab = lazy(async () => ({
  default: (await import('@/routes/clients/tabs/ActivityTab')).ActivityTab,
}));

const TaskList = lazy(async () => ({ default: (await import('@/routes/tasks/TaskList')).TaskList }));
const TaskDetail = lazy(async () => ({
  default: (await import('@/routes/tasks/TaskDetail')).TaskDetail,
}));
const ComplianceList = lazy(async () => ({
  default: (await import('@/routes/compliance/ComplianceList')).ComplianceList,
}));
const ComplianceDetail = lazy(async () => ({
  default: (await import('@/routes/compliance/ComplianceDetail')).ComplianceDetail,
}));
const ComplianceGenerate = lazy(async () => ({
  default: (await import('@/routes/compliance/ComplianceGenerate')).ComplianceGenerate,
}));
const DocumentsIndex = lazy(async () => ({
  default: (await import('@/routes/documents/DocumentsIndex')).DocumentsIndex,
}));
const RequestsIndex = lazy(async () => ({
  default: (await import('@/routes/requests/RequestsIndex')).RequestsIndex,
}));
const MessagesIndex = lazy(async () => ({
  default: (await import('@/routes/messages/MessagesIndex')).MessagesIndex,
}));
const ComplianceReport = lazy(async () => ({
  default: (await import('@/routes/reports/ComplianceReport')).ComplianceReport,
}));
const WorkloadReport = lazy(async () => ({
  default: (await import('@/routes/reports/WorkloadReport')).WorkloadReport,
}));
const RosterReport = lazy(async () => ({
  default: (await import('@/routes/reports/RosterReport')).RosterReport,
}));
const NotificationsIndex = lazy(async () => ({
  default: (await import('@/routes/notifications/NotificationsIndex')).NotificationsIndex,
}));
const Profile = lazy(async () => ({ default: (await import('@/routes/profile/Profile')).Profile }));

const FirmSettings = lazy(async () => ({
  default: (await import('@/routes/settings/FirmSettings')).FirmSettings,
}));
const UsersList = lazy(async () => ({
  default: (await import('@/routes/settings/UsersList')).UsersList,
}));
const UserDetail = lazy(async () => ({
  default: (await import('@/routes/settings/UserDetail')).UserDetail,
}));
const Catalogue = lazy(async () => ({
  default: (await import('@/routes/settings/Catalogue')).Catalogue,
}));
const CatalogueForm = lazy(async () => ({
  default: (await import('@/routes/settings/CatalogueForm')).CatalogueForm,
}));
const UnlinkedAccounts = lazy(async () => ({
  default: (await import('@/routes/settings/UnlinkedAccounts')).UnlinkedAccounts,
}));
const AuditLog = lazy(async () => ({ default: (await import('@/routes/settings/AuditLog')).AuditLog }));
const Jobs = lazy(async () => ({ default: (await import('@/routes/settings/Jobs')).Jobs }));

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

const staffOnly = (element: React.ReactNode) => (
  <ProtectedRoute>
    <RoleGate roles={['admin', 'staff']} fallback="home">
      {element}
    </RoleGate>
  </ProtectedRoute>
);

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/unlinked" element={<Unlinked />} />
        <Route path="/403" element={<Forbidden />} />
        <Route path="/404" element={<NotFound />} />
      </Route>

      <Route element={staffOnly(<StaffLayout />)}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/my-work" element={<MyWork />} />
        <Route path="/clients" element={<ClientList />} />
        <Route path="/clients/new" element={<ClientNew />} />
        <Route path="/clients/:clientId/edit" element={<ClientEdit />} />
        <Route path="/clients/:clientId" element={<ClientRecord />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<ProfileTab />} />
          <Route path="documents" element={<DocumentsTab />} />
          <Route path="compliance" element={<ComplianceTab />} />
          <Route path="tasks" element={<TasksTab />} />
          <Route path="requests" element={<RequestsTab />} />
          <Route path="messages" element={<MessagesTab />} />
          <Route path="activity" element={<ActivityTab />} />
        </Route>
        <Route path="/tasks" element={<TaskList />} />
        <Route path="/tasks/:taskId" element={<TaskDetail />} />
        <Route path="/compliance" element={<ComplianceList />} />
        <Route path="/compliance/generate" element={<ComplianceGenerate />} />
        <Route path="/compliance/:complianceId" element={<ComplianceDetail />} />
        <Route path="/documents" element={<DocumentsIndex />} />
        <Route path="/requests" element={<RequestsIndex />} />
        <Route path="/messages" element={<MessagesIndex />} />
        <Route path="/reports/compliance" element={<ComplianceReport />} />
        <Route path="/reports/workload" element={<WorkloadReport />} />
        <Route path="/reports/roster" element={<RosterReport />} />
        <Route path="/notifications" element={<NotificationsIndex />} />
        <Route path="/profile" element={<Profile />} />

        <Route
          path="/settings/firm"
          element={<RoleGate roles={['admin']}>{<FirmSettings />}</RoleGate>}
        />
        <Route
          path="/settings/users"
          element={<RoleGate roles={['admin']}>{<UsersList />}</RoleGate>}
        />
        <Route
          path="/settings/users/:userId"
          element={<RoleGate roles={['admin']}>{<UserDetail />}</RoleGate>}
        />
        <Route
          path="/settings/catalogue"
          element={<RoleGate roles={['admin']}>{<Catalogue />}</RoleGate>}
        />
        <Route
          path="/settings/catalogue/new"
          element={<RoleGate roles={['admin']}>{<CatalogueForm />}</RoleGate>}
        />
        <Route
          path="/settings/catalogue/:typeId"
          element={<RoleGate roles={['admin']}>{<CatalogueForm />}</RoleGate>}
        />
        <Route
          path="/settings/unlinked-accounts"
          element={<RoleGate roles={['admin']}>{<UnlinkedAccounts />}</RoleGate>}
        />
        <Route
          path="/settings/audit"
          element={<RoleGate roles={['admin']}>{<AuditLog />}</RoleGate>}
        />
        <Route path="/settings/jobs" element={<RoleGate roles={['admin']}>{<Jobs />}</RoleGate>} />
      </Route>

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

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomeRedirect />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
