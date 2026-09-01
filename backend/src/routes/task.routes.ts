import { Router } from 'express';
import type { Types } from 'mongoose';

import * as comments from '../controllers/taskComment.controller.js';
import * as controller from '../controllers/task.controller.js';
import { mutationLimiter, readLimiter } from '../middleware/rateLimit.js';
import {
  requireClientScope,
  requireResolvedClientScope,
} from '../middleware/requireClientScope.js';
import { requireCapability } from '../middleware/requireRole.js';
import { handle } from '../middleware/validate.js';
import { clientIdOfTask } from '../services/task.service.js';
import { taskIdOfComment } from '../services/taskComment.service.js';
import { idParam, pageQuery } from '../validators/common.validators.js';
import {
  assignTaskBody,
  commentBody,
  createTaskBody,
  myWorkQuery,
  taskListQuery,
  taskStatusBody,
  updateTaskBody,
} from '../validators/task.validators.js';

export const taskRouter: Router = Router();

const scopeViaTask = requireResolvedClientScope(clientIdOfTask);

taskRouter.get(
  '/',
  readLimiter,
  requireCapability('task:read'),
  handle({ query: taskListQuery }, controller.list),
);

taskRouter.post(
  '/',
  mutationLimiter,
  requireCapability('task:create'),
  requireClientScope('body:clientId', { optional: true }),
  handle({ body: createTaskBody }, controller.create),
);

taskRouter.get(
  '/:id',
  readLimiter,
  requireCapability('task:read'),
  scopeViaTask,
  handle({ params: idParam }, controller.detail),
);

taskRouter.patch(
  '/:id',
  mutationLimiter,
  requireCapability('task:update'),
  scopeViaTask,
  handle(
    { params: idParam, body: updateTaskBody, rejectBodyKeys: ['clientId', 'client'] },
    controller.update,
  ),
);

taskRouter.post(
  '/:id/assign',
  mutationLimiter,
  requireCapability('task:assign'),
  scopeViaTask,
  handle({ params: idParam, body: assignTaskBody }, controller.assign),
);

taskRouter.post(
  '/:id/status',
  mutationLimiter,
  requireCapability('task:update'),
  scopeViaTask,
  handle({ params: idParam, body: taskStatusBody }, controller.changeStatus),
);

taskRouter.delete(
  '/:id',
  mutationLimiter,
  requireCapability('task:delete'),
  scopeViaTask,
  handle({ params: idParam }, controller.remove),
);

taskRouter.get(
  '/:id/comments',
  readLimiter,
  requireCapability('task_comment:read'),
  scopeViaTask,
  handle({ params: idParam, query: pageQuery }, comments.list),
);

taskRouter.post(
  '/:id/comments',
  mutationLimiter,
  requireCapability('task_comment:write'),
  scopeViaTask,
  handle({ params: idParam, body: commentBody }, comments.create),
);

export const taskCommentRouter: Router = Router();

const scopeViaComment = requireResolvedClientScope(async (commentId: Types.ObjectId) => {
  const taskId = await taskIdOfComment(commentId);
  return clientIdOfTask(taskId);
});

taskCommentRouter.patch(
  '/:id',
  mutationLimiter,
  requireCapability('task_comment:write'),
  scopeViaComment,
  handle({ params: idParam, body: commentBody }, comments.update),
);

taskCommentRouter.delete(
  '/:id',
  mutationLimiter,
  requireCapability('task_comment:write'),
  scopeViaComment,
  handle({ params: idParam }, comments.remove),
);

export const myWorkRouter: Router = Router();

myWorkRouter.get(
  '/',
  readLimiter,
  requireCapability('my_work:read'),
  handle({ query: myWorkQuery }, controller.myWork),
);
