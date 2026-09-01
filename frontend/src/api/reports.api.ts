import { apiGet } from '@/api/client';
import { csvFilename, downloadCsv } from '@/lib/download';
import type { QueryParams } from '@/types/api';
import type { ReportName } from '@/types/enums';
import type {
  ComplianceReport,
  DashboardSummary,
  RosterRow,
  WorkloadRow,
} from '@/types/models';

export const fetchDashboard = (): Promise<DashboardSummary> =>
  apiGet<DashboardSummary>('/reports/dashboard');

export const fetchComplianceReport = (params: QueryParams): Promise<ComplianceReport> =>
  apiGet<ComplianceReport>('/reports/compliance', params);

export const fetchWorkloadReport = (params: QueryParams): Promise<WorkloadRow[]> =>
  apiGet<WorkloadRow[]>('/reports/workload', params);

export const fetchRosterReport = (params: QueryParams): Promise<RosterRow[]> =>
  apiGet<RosterRow[]>('/reports/roster', params);

export const exportReportCsv = (name: ReportName, params: QueryParams): Promise<void> =>
  downloadCsv(`/reports/${name}/export`, csvFilename(name), params);
