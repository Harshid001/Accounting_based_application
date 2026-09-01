import { Router } from 'express';

import * as audit from '../controllers/audit.controller.js';
import * as health from '../controllers/health.controller.js';
import * as jobs from '../controllers/job.controller.js';
import * as me from '../controllers/me.controller.js';
import * as messages from '../controllers/message.controller.js';
import * as notifications from '../controllers/notification.controller.js';
import * as reports from '../controllers/report.controller.js';
import * as search from '../controllers/search.controller.js';
import * as settings from '../controllers/settings.controller.js';
import * as users from '../controllers/user.controller.js';
import {
  bulkLimiter,
  exportLimiter,
  mutationLimiter,
  publicReportLimiter,
  readLimiter,
  searchLimiter,
} from '../middleware/rateLimit.js';
import { requireCapability } from '../middleware/requireRole.js';
import { handle, handlePublic } from '../middleware/validate.js';
import { idParam, pageQuery } from '../validators/common.validators.js';
import { messageListQuery, notificationListQuery } from '../validators/message.validators.js';
import {
  auditListQuery,
  firmSettingsBody,
  reportFiltersQuery,
  reportNameParam,
  searchQuery,
} from '../validators/report.validators.js';
import {
  adminUpdateUserBody,
  clientErrorBody,
  jobListQuery,
  jobNameParam,
  linkedClientsBody,
  purgeUnlinkedBody,
  roleBody,
  updateMeBody,
  userListQuery,
} from '../validators/user.validators.js';

const PRIVILEGED_SELF_FIELDS = ['role', 'status', 'linkedClients', 'emailVerified', 'email'];

export const meRouter: Router = Router();

meRouter.get(
  '/',
  readLimiter,
  requireCapability('profile:manage', { allowUnlinked: true }),
  handle({}, me.readMe),
);
meRouter.patch(
  '/',
  mutationLimiter,
  requireCapability('profile:manage', { allowUnlinked: true }),
  handle({ body: updateMeBody, rejectBodyKeys: PRIVILEGED_SELF_FIELDS }, me.patchMe),
);
meRouter.get(
  '/sessions',
  readLimiter,
  requireCapability('profile:manage', { allowUnlinked: true }),
  handle({}, me.listMySessions),
);
meRouter.delete(
  '/sessions',
  mutationLimiter,
  requireCapability('profile:manage', { allowUnlinked: true }),
  handle({}, me.signOutEverywhereElse),
);

export const userRouter: Router = Router();

userRouter.get(
  '/staff',
  readLimiter,
  requireCapability('client:read'),
  handle({ query: pageQuery }, users.staffOptions),
);
userRouter.get('/', readLimiter, requireCapability('user:manage'), handle({ query: userListQuery }, users.list));
userRouter.delete(
  '/unlinked',
  bulkLimiter,
  requireCapability('user:manage'),
  handle({ body: purgeUnlinkedBody }, users.purgeUnlinked),
);
userRouter.get('/:id', readLimiter, requireCapability('user:manage'), handle({ params: idParam }, users.detail));
userRouter.patch(
  '/:id',
  mutationLimiter,
  requireCapability('user:manage'),
  handle(
    { params: idParam, body: adminUpdateUserBody, rejectBodyKeys: ['role', 'linkedClients'] },
    users.update,
  ),
);
userRouter.post(
  '/:id/role',
  mutationLimiter,
  requireCapability('user:manage'),
  handle({ params: idParam, body: roleBody }, users.setRole),
);
userRouter.put(
  '/:id/linked-clients',
  mutationLimiter,
  requireCapability('user:manage'),
  handle({ params: idParam, body: linkedClientsBody }, users.setLinks),
);
userRouter.post(
  '/:id/deactivate',
  mutationLimiter,
  requireCapability('user:manage'),
  handle({ params: idParam }, users.deactivate),
);
userRouter.post(
  '/:id/activate',
  mutationLimiter,
  requireCapability('user:manage'),
  handle({ params: idParam }, users.activate),
);

export const messageRouter: Router = Router();

messageRouter.get(
  '/threads',
  readLimiter,
  requireCapability('message:threads'),
  handle({ query: messageListQuery }, messages.threads),
);

export const notificationRouter: Router = Router();

notificationRouter.get(
  '/',
  readLimiter,
  requireCapability('notification:read'),
  handle({ query: notificationListQuery }, notifications.list),
);
notificationRouter.get(
  '/unread-count',
  readLimiter,
  requireCapability('notification:read'),
  handle({}, notifications.unreadCount),
);
notificationRouter.post(
  '/read-all',
  mutationLimiter,
  requireCapability('notification:write'),
  handle({}, notifications.markAllRead),
);
notificationRouter.post(
  '/:id/read',
  mutationLimiter,
  requireCapability('notification:write'),
  handle({ params: idParam }, notifications.markRead),
);

export const reportRouter: Router = Router();

reportRouter.get('/dashboard', readLimiter, requireCapability('report:read'), handle({}, reports.dashboard));
reportRouter.get(
  '/compliance',
  readLimiter,
  requireCapability('report:read'),
  handle({ query: reportFiltersQuery }, reports.compliance),
);
reportRouter.get(
  '/workload',
  readLimiter,
  requireCapability('report:read'),
  handle({ query: reportFiltersQuery }, reports.workload),
);
reportRouter.get(
  '/roster',
  readLimiter,
  requireCapability('report:read'),
  handle({ query: reportFiltersQuery }, reports.roster),
);
reportRouter.get(
  '/:name/export',
  exportLimiter,
  requireCapability('report:export'),
  handle({ params: reportNameParam, query: reportFiltersQuery }, reports.exportReport),
);

export const settingsRouter: Router = Router();

settingsRouter.get('/firm', readLimiter, requireCapability('settings:read'), handle({}, settings.read));
settingsRouter.patch(
  '/firm',
  mutationLimiter,
  requireCapability('settings:write'),
  handle({ body: firmSettingsBody }, settings.update),
);

export const auditRouter: Router = Router();

auditRouter.get('/', readLimiter, requireCapability('audit:read'), handle({ query: auditListQuery }, audit.list));

export const jobRouter: Router = Router();

jobRouter.get('/', readLimiter, requireCapability('job:manage'), handle({ query: jobListQuery }, jobs.list));
jobRouter.post(
  '/:name/run',
  bulkLimiter,
  requireCapability('job:manage'),
  handle({ params: jobNameParam }, jobs.run),
);

export const searchRouter: Router = Router();

searchRouter.get('/', searchLimiter, requireCapability('search:run'), handle({ query: searchQuery }, search.run));

export const publicRouter: Router = Router();

publicRouter.get('/health', health.health);
publicRouter.post(
  '/client-errors',
  publicReportLimiter,
  handlePublic({ body: clientErrorBody }, health.reportClientError),
);
