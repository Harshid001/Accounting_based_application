import { Types } from 'mongoose';
import type { z } from 'zod';

import { sendCreated, sendData, sendList, sendNoContent } from '../lib/http.js';
import { buildPageMeta, toPageRequest } from '../lib/pagination.js';
import type { RouteContext } from '../middleware/validate.js';
import {
  serialiseDocumentDetail,
  serialiseDocumentRow,
} from '../serializers/document.serializer.js';
import {
  addVersion,
  downloadUrl,
  finaliseUpload,
  getDocument,
  hardDeleteDocument,
  listDocuments,
  presignUpload,
  setDocumentArchived,
  updateDocument,
} from '../services/document.service.js';
import { fulfilDocumentRequest } from '../services/documentRequest.service.js';
import type {
  FinaliseBody,
  PresignBody,
  documentListQuery,
  documentPatchBody,
  versionBody,
} from '../validators/document.validators.js';

type ListQuery = z.infer<typeof documentListQuery>;
type PatchBody = z.infer<typeof documentPatchBody>;
type VersionBody = z.infer<typeof versionBody>;

export const presign = async (
  input: { body: PresignBody },
  ctx: RouteContext,
): Promise<void> => {
  const result = await presignUpload(
    ctx.clientId(),
    input.body.filename,
    input.body.mimeType,
    input.body.sizeBytes,
  );
  sendData(ctx.res, result);
};

export const finalise = async (
  input: { body: FinaliseBody },
  ctx: RouteContext,
): Promise<void> => {
  const clientId = ctx.clientId();
  const document = await finaliseUpload(
    {
      clientId,
      storageKey: input.body.storageKey,
      title: input.body.title,
      filename: input.body.filename,
      mimeType: input.body.mimeType,
      documentType: input.body.documentType,
      customTypeLabel: input.body.customTypeLabel,
      complianceItemId: input.body.complianceItemId,
      documentRequestId: input.body.documentRequestId,
    },
    ctx.user,
    ctx.actor,
  );
  if (input.body.documentRequestId) {
    await fulfilDocumentRequest(
      new Types.ObjectId(input.body.documentRequestId),
      document._id,
      ctx.actor,
    );
  }
  sendCreated(ctx.res, serialiseDocumentDetail(document));
};

export const list = async (
  input: { query: ListQuery },
  ctx: RouteContext,
): Promise<void> => {
  const page = toPageRequest(input.query.page, input.query.limit);
  const { items, total } = await listDocuments(ctx.user, input.query, page);
  sendList(ctx.res, items.map(serialiseDocumentRow), buildPageMeta(total, page));
};

export const detail = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const document = await getDocument(new Types.ObjectId(input.params.id));
  sendData(ctx.res, serialiseDocumentDetail(document));
};

export const addNewVersion = async (
  input: { params: { id: string }; body: VersionBody },
  ctx: RouteContext,
): Promise<void> => {
  const document = await addVersion(
    new Types.ObjectId(input.params.id),
    input.body.storageKey,
    input.body.filename,
    input.body.mimeType,
    ctx.user,
    ctx.actor,
  );
  sendData(ctx.res, serialiseDocumentDetail(document));
};

export const download = async (
  input: { params: { id: string }; query: { version?: number } },
  ctx: RouteContext,
): Promise<void> => {
  const result = await downloadUrl(new Types.ObjectId(input.params.id), input.query.version);
  sendData(ctx.res, result);
};

export const patch = async (
  input: { params: { id: string }; body: PatchBody },
  ctx: RouteContext,
): Promise<void> => {
  const document = await updateDocument(
    new Types.ObjectId(input.params.id),
    input.body,
    ctx.actor,
  );
  sendData(ctx.res, serialiseDocumentDetail(document));
};

export const archive = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const document = await setDocumentArchived(
    new Types.ObjectId(input.params.id),
    true,
    ctx.user,
    ctx.actor,
  );
  sendData(ctx.res, serialiseDocumentRow(document));
};

export const restore = async (
  input: { params: { id: string } },
  ctx: RouteContext,
): Promise<void> => {
  const document = await setDocumentArchived(
    new Types.ObjectId(input.params.id),
    false,
    ctx.user,
    ctx.actor,
  );
  sendData(ctx.res, serialiseDocumentRow(document));
};

export const remove = async (
  input: { params: { id: string }; body: { confirm: string } },
  ctx: RouteContext,
): Promise<void> => {
  await hardDeleteDocument(new Types.ObjectId(input.params.id), input.body.confirm, ctx.actor);
  sendNoContent(ctx.res);
};
