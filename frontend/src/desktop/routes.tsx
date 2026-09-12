import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { RoleGate } from '@/app/RoleGate';
import { ProtectedRoute } from '@/app/ProtectedRoute';
import { AuthLayout } from '@/layouts/AuthLayout';
import { StaffLayout } from '@/layouts/StaffLayout';

const SignIn = lazy(async () => ({ default: (await import('@/shared/auth/SignIn')).SignIn }));
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
const WebPortalRequired = lazy(async () => ({
  default: (await import('@/shared/shell/WebPortalRequired')).WebPortalRequired,
}));

const Dashboard = lazy(async () => ({
  default: (await import('@/desktop/dashboard/Dashboard')).Dashboard,
}));
const MyWork = lazy(async () => ({ default: (await import('@/desktop/my-work/MyWork')).MyWork }));
const ClientList = lazy(async () => ({
  default: (await import('@/desktop/clients/ClientList')).ClientList,
}));
const ClientNew = lazy(async () => ({
  default: (await import('@/desktop/clients/ClientNew')).ClientNew,
}));
const ClientEdit = lazy(async () => ({
  default: (await import('@/desktop/clients/ClientEdit')).ClientEdit,
}));
const ClientRecord = lazy(async () => ({
  default: (await import('@/desktop/clients/ClientRecord')).ClientRecord,
}));
const ProfileTab = lazy(async () => ({
  default: (await import('@/desktop/clients/tabs/ProfileTab')).ProfileTab,
}));
const DocumentsTab = lazy(async () => ({
  default: (await import('@/desktop/clients/tabs/DocumentsTab')).DocumentsTab,
}));
const ComplianceTab = lazy(async () => ({
  default: (await import('@/desktop/clients/tabs/ComplianceTab')).ComplianceTab,
}));
const TasksTab = lazy(async () => ({
  default: (await import('@/desktop/clients/tabs/TasksTab')).TasksTab,
}));
const RequestsTab = lazy(async () => ({
  default: (await import('@/desktop/clients/tabs/RequestsTab')).RequestsTab,
}));
const MessagesTab = lazy(async () => ({
  default: (await import('@/desktop/clients/tabs/MessagesTab')).MessagesTab,
}));
const ActivityTab = lazy(async () => ({
  default: (await import('@/desktop/clients/tabs/ActivityTab')).ActivityTab,
}));

const TaskList = lazy(async () => ({
  default: (await import('@/desktop/tasks/TaskList')).TaskList,
}));
const TaskDetail = lazy(async () => ({
  default: (await import('@/desktop/tasks/TaskDetail')).TaskDetail,
}));
const ComplianceList = lazy(async () => ({
  default: (await import('@/desktop/compliance/ComplianceList')).ComplianceList,
}));
const ComplianceDetail = lazy(async () => ({
  default: (await import('@/desktop/compliance/ComplianceDetail')).ComplianceDetail,
}));
const ComplianceGenerate = lazy(async () => ({
  default: (await import('@/desktop/compliance/ComplianceGenerate')).ComplianceGenerate,
}));
const AutomationMonitor = lazy(async () => ({
  default: (await import('@/desktop/automation/AutomationMonitor')).AutomationMonitor,
}));
const AiAgentPage = lazy(async () => ({
  default: (await import('@/desktop/agent/AiAgentPage')).AiAgentPage,
}));
const BooksOverview = lazy(async () => ({
  default: (await import('@/desktop/books/BooksOverview')).BooksOverview,
}));
const ChartOfAccounts = lazy(async () => ({
  default: (await import('@/desktop/books/ChartOfAccounts')).ChartOfAccounts,
}));
const VoucherList = lazy(async () => ({
  default: (await import('@/desktop/books/VoucherList')).VoucherList,
}));
const VoucherEntry = lazy(async () => ({
  default: (await import('@/desktop/books/VoucherEntry')).VoucherEntry,
}));
const VoucherDetail = lazy(async () => ({
  default: (await import('@/desktop/books/VoucherDetail')).VoucherDetail,
}));
const DayBook = lazy(async () => ({
  default: (await import('@/desktop/books/DayBook')).DayBook,
}));
const Ledger = lazy(async () => ({ default: (await import('@/desktop/books/Ledger')).Ledger }));
const TrialBalance = lazy(async () => ({
  default: (await import('@/desktop/books/TrialBalance')).TrialBalance,
}));
const DocumentsIndex = lazy(async () => ({
  default: (await import('@/desktop/documents/DocumentsIndex')).DocumentsIndex,
}));
const ConverterPage = lazy(async () => ({
  default: (await import('@/desktop/converter/ConverterPage')).ConverterPage,
}));
const RequestsIndex = lazy(async () => ({
  default: (await import('@/desktop/requests/RequestsIndex')).RequestsIndex,
}));
const MessagesIndex = lazy(async () => ({
  default: (await import('@/desktop/messages/MessagesIndex')).MessagesIndex,
}));
const ComplianceReport = lazy(async () => ({
  default: (await import('@/desktop/reports/ComplianceReport')).ComplianceReport,
}));
const WorkloadReport = lazy(async () => ({
  default: (await import('@/desktop/reports/WorkloadReport')).WorkloadReport,
}));
const RosterReport = lazy(async () => ({
  default: (await import('@/desktop/reports/RosterReport')).RosterReport,
}));
const NotificationsIndex = lazy(async () => ({
  default: (await import('@/desktop/notifications/NotificationsIndex')).NotificationsIndex,
}));
const Profile = lazy(async () => ({ default: (await import('@/desktop/profile/Profile')).Profile }));

const FirmSettings = lazy(async () => ({
  default: (await import('@/desktop/settings/FirmSettings')).FirmSettings,
}));
const AiSettings = lazy(async () => ({
  default: (await import('@/desktop/settings/AiSettings')).AiSettings,
}));
const UsersList = lazy(async () => ({
  default: (await import('@/desktop/settings/UsersList')).UsersList,
}));
const UserDetail = lazy(async () => ({
  default: (await import('@/desktop/settings/UserDetail')).UserDetail,
}));
const Catalogue = lazy(async () => ({
  default: (await import('@/desktop/settings/Catalogue')).Catalogue,
}));
const CatalogueForm = lazy(async () => ({
  default: (await import('@/desktop/settings/CatalogueForm')).CatalogueForm,
}));
const UnlinkedAccounts = lazy(async () => ({
  default: (await import('@/desktop/settings/UnlinkedAccounts')).UnlinkedAccounts,
}));
const AuditLog = lazy(async () => ({
  default: (await import('@/desktop/settings/AuditLog')).AuditLog,
}));
const Jobs = lazy(async () => ({ default: (await import('@/desktop/settings/Jobs')).Jobs }));
const WorkstationsPage = lazy(async () => ({
  default: (await import('@/desktop/settings/Workstations')).WorkstationsPage,
}));

const staffSettings = (
  <>
    <Route path="/settings/firm" element={<RoleGate roles={['admin']}>{<FirmSettings />}</RoleGate>} />
    <Route path="/settings/ai" element={<RoleGate roles={['admin']}>{<AiSettings />}</RoleGate>} />
    <Route path="/settings/users" element={<RoleGate roles={['admin']}>{<UsersList />}</RoleGate>} />
    <Route
      path="/settings/users/:userId"
      element={<RoleGate roles={['admin']}>{<UserDetail />}</RoleGate>}
    />
    <Route
      path="/settings/workstations"
      element={<RoleGate roles={['admin']}>{<WorkstationsPage />}</RoleGate>}
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
    <Route path="/settings/audit" element={<RoleGate roles={['admin']}>{<AuditLog />}</RoleGate>} />
    <Route path="/settings/jobs" element={<RoleGate roles={['admin']}>{<Jobs />}</RoleGate>} />
  </>
);

/**
 * Desktop shell route table: the full admin/staff workspace, nothing else.
 * The web build never imports this module, so its chunks are absent from
 * the web bundle entirely (rule: web = clients only).
 */
export function DesktopRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/admin/sign-in" element={<Navigate to="/sign-in" replace />} />
        <Route path="/staff/sign-in" element={<Navigate to="/sign-in" replace />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/unlinked" element={<Unlinked />} />
        <Route path="/403" element={<Forbidden />} />
        <Route path="/404" element={<NotFound />} />
      </Route>

      {/* Desktop shell: a client session lands here, never on portal routes. */}
      <Route path="/web-portal-required" element={<WebPortalRequired />} />

      <Route
        element={
          <ProtectedRoute>
            <RoleGate roles={['admin', 'staff']} fallback="home">
              <StaffLayout />
            </RoleGate>
          </ProtectedRoute>
        }
      >
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
        <Route path="/automation" element={<AutomationMonitor />} />
        <Route path="/agent" element={<AiAgentPage />} />
        <Route path="/ai-agent" element={<Navigate to="/agent" replace />} />
        <Route path="/copilot" element={<Navigate to="/agent" replace />} />
        <Route path="/books" element={<BooksOverview />} />
        <Route path="/books/vouchers" element={<VoucherList />} />
        <Route path="/books/vouchers/new" element={<VoucherEntry />} />
        <Route path="/books/vouchers/:voucherId/edit" element={<VoucherEntry />} />
        <Route path="/books/vouchers/:voucherId" element={<VoucherDetail />} />
        <Route path="/books/day-book" element={<DayBook />} />
        <Route path="/books/ledger" element={<Ledger />} />
        <Route path="/books/trial-balance" element={<TrialBalance />} />
        <Route path="/books/accounts" element={<ChartOfAccounts />} />
        <Route path="/documents" element={<DocumentsIndex />} />
        <Route path="/converter" element={<ConverterPage />} />
        <Route path="/requests" element={<RequestsIndex />} />
        <Route path="/messages" element={<MessagesIndex />} />
        <Route path="/reports/compliance" element={<ComplianceReport />} />
        <Route path="/reports/workload" element={<WorkloadReport />} />
        <Route path="/reports/roster" element={<RosterReport />} />
        <Route path="/notifications" element={<NotificationsIndex />} />
        <Route path="/profile" element={<Profile />} />
        {staffSettings}
      </Route>

      <Route path="/" element={<Navigate to="/sign-in" replace />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}

/** Alias target: @/app/routes.shell resolves here in desktop builds. */
export const ShellRoutes = DesktopRoutes;
