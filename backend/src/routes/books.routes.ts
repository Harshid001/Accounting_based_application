import { Router } from 'express';

import * as controller from '../controllers/books.controller.js';
import { exportLimiter, mutationLimiter, readLimiter } from '../middleware/rateLimit.js';
import {
  requireClientScope,
  requireResolvedClientScope,
} from '../middleware/requireClientScope.js';
import { requireCapability } from '../middleware/requireRole.js';
import { handle } from '../middleware/validate.js';
import { clientIdOfAccount, clientIdOfVoucher } from '../services/books.service.js';
import {
  accountListQuery,
  booksStatusQuery,
  createAccountBody,
  createVoucherBody,
  dayBookQuery,
  ledgerQuery,
  lockPeriodBody,
  periodLockListQuery,
  periodParam,
  reverseVoucherBody,
  trialBalanceQuery,
  updateAccountBody,
  updateVoucherBody,
  voucherListQuery,
} from '../validators/books.validators.js';
import { idParam } from '../validators/common.validators.js';

export const booksRouter: Router = Router();

const scopeViaAccount = requireResolvedClientScope(clientIdOfAccount);
const scopeViaVoucher = requireResolvedClientScope(clientIdOfVoucher);
const scopeViaQuery = requireClientScope('query:client');
const scopeViaBody = requireClientScope('body:clientId');

// --- status --------------------------------------------------------------

booksRouter.get(
  '/status',
  readLimiter,
  requireCapability('books:read'),
  scopeViaQuery,
  handle({ query: booksStatusQuery }, controller.status),
);

// --- accounts ------------------------------------------------------------

booksRouter.get(
  '/accounts',
  readLimiter,
  requireCapability('books:read'),
  scopeViaQuery,
  handle({ query: accountListQuery }, controller.accountsList),
);

booksRouter.post(
  '/accounts',
  mutationLimiter,
  requireCapability('books:write'),
  scopeViaBody,
  handle({ body: createAccountBody }, controller.accountCreate),
);

booksRouter.get(
  '/accounts/:id',
  readLimiter,
  requireCapability('books:read'),
  scopeViaAccount,
  handle({ params: idParam }, controller.accountDetail),
);

booksRouter.patch(
  '/accounts/:id',
  mutationLimiter,
  requireCapability('books:write'),
  scopeViaAccount,
  handle(
    {
      params: idParam,
      body: updateAccountBody,
      rejectBodyKeys: ['client', 'clientId', 'code', 'type', 'isSystem'],
    },
    controller.accountUpdate,
  ),
);

// --- vouchers ------------------------------------------------------------

booksRouter.get(
  '/vouchers',
  readLimiter,
  requireCapability('books:read'),
  scopeViaQuery,
  handle({ query: voucherListQuery }, controller.vouchersList),
);

booksRouter.post(
  '/vouchers',
  mutationLimiter,
  requireCapability('books:write'),
  scopeViaBody,
  handle(
    {
      body: createVoucherBody,
      rejectBodyKeys: ['status', 'voucherNo', 'sequence', 'derived', 'totalPaise'],
    },
    controller.voucherCreate,
  ),
);

booksRouter.get(
  '/vouchers/:id',
  readLimiter,
  requireCapability('books:read'),
  scopeViaVoucher,
  handle({ params: idParam }, controller.voucherDetail),
);

booksRouter.patch(
  '/vouchers/:id',
  mutationLimiter,
  requireCapability('books:write'),
  scopeViaVoucher,
  handle(
    {
      params: idParam,
      body: updateVoucherBody,
      rejectBodyKeys: [
        'client',
        'clientId',
        'status',
        'voucherNo',
        'sequence',
        'source',
        'derived',
        'totalPaise',
      ],
    },
    controller.voucherUpdate,
  ),
);

booksRouter.delete(
  '/vouchers/:id',
  mutationLimiter,
  requireCapability('books:delete_draft'),
  scopeViaVoucher,
  handle({ params: idParam }, controller.voucherDelete),
);

booksRouter.post(
  '/vouchers/:id/post',
  mutationLimiter,
  requireCapability('books:post'),
  scopeViaVoucher,
  handle({ params: idParam }, controller.voucherPost),
);

booksRouter.post(
  '/vouchers/:id/reverse',
  mutationLimiter,
  requireCapability('books:post'),
  scopeViaVoucher,
  handle({ params: idParam, body: reverseVoucherBody }, controller.voucherReverse),
);

// --- reports -------------------------------------------------------------

booksRouter.get(
  '/day-book',
  readLimiter,
  requireCapability('books:read'),
  scopeViaQuery,
  handle({ query: dayBookQuery }, controller.dayBookReport),
);

booksRouter.get(
  '/ledger',
  readLimiter,
  requireCapability('books:read'),
  scopeViaQuery,
  handle({ query: ledgerQuery }, controller.ledgerReport),
);

booksRouter.get(
  '/trial-balance',
  readLimiter,
  requireCapability('books:read'),
  scopeViaQuery,
  handle({ query: trialBalanceQuery }, controller.trialBalanceReport),
);

booksRouter.get(
  '/trial-balance/export',
  exportLimiter,
  requireCapability('books:export'),
  scopeViaQuery,
  handle({ query: trialBalanceQuery }, controller.trialBalanceCsv),
);

// --- period locks --------------------------------------------------------

booksRouter.get(
  '/periods',
  readLimiter,
  requireCapability('books:read'),
  scopeViaQuery,
  handle({ query: periodLockListQuery }, controller.locksList),
);

booksRouter.post(
  '/periods/:period/lock',
  mutationLimiter,
  requireCapability('books:lock'),
  scopeViaBody,
  handle({ params: periodParam, body: lockPeriodBody }, controller.lockCreate),
);
