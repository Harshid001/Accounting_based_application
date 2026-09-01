import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth.js';
import { clientRouter, clientServiceRouter } from './client.routes.js';
import { complianceRouter } from './compliance.routes.js';
import { complianceTypeRouter } from './complianceType.routes.js';
import { documentRequestRouter } from './documentRequest.routes.js';
import { documentRouter } from './document.routes.js';
import {
  auditRouter,
  jobRouter,
  meRouter,
  messageRouter,
  notificationRouter,
  publicRouter,
  reportRouter,
  searchRouter,
  settingsRouter,
  userRouter,
} from './misc.routes.js';
import { portalRouter } from './portal.routes.js';
import { storageRouter } from './storage.routes.js';
import { myWorkRouter, taskCommentRouter, taskRouter } from './task.routes.js';

export const apiRouter: Router = Router();

apiRouter.use(publicRouter);
apiRouter.use(storageRouter);

apiRouter.use(requireAuth);

apiRouter.use('/me', meRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/clients', clientRouter);
apiRouter.use('/client-services', clientServiceRouter);
apiRouter.use('/compliance-types', complianceTypeRouter);
apiRouter.use('/compliance', complianceRouter);
apiRouter.use('/tasks', taskRouter);
apiRouter.use('/task-comments', taskCommentRouter);
apiRouter.use('/my-work', myWorkRouter);
apiRouter.use('/documents', documentRouter);
apiRouter.use('/document-requests', documentRequestRouter);
apiRouter.use('/messages', messageRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/portal', portalRouter);
apiRouter.use('/reports', reportRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.use('/jobs', jobRouter);
apiRouter.use('/search', searchRouter);
