import { extname } from 'node:path';

import type { QueryFilter, Types } from 'mongoose';

import { deleteObjects, headObject, presignGet, presignPut } from '../config/fileStorage.js';
import type { PresignedUpload } from '../config/fileStorage.js';
import { randomStorageKey } from '../lib/crypto.js';
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  ALLOWED_UPLOAD_TYPES,
  MAX_DOCUMENT_VERSIONS,
  MAX_UPLOAD_BYTES,
} from '../lib/enums.js';
import type { DocumentType } from '../lib/enums.js';
import {
  conflict,
  notFound,
  payloadTooLarge,
  unsupportedMediaType,
  validationFailed,
} from '../lib/errors.js';
import { escapeRegex } from '../lib/identifiers.js';
import type { PageRequest } from '../lib/pagination.js';
import { parseSort, withTiebreak } from '../lib/pagination.js';
import type { DocumentAttributes } from '../models/document.model.js';
import { DocumentModel } from '../models/document.model.js';
import type { AuthenticatedUser, RequestActor } from '../types/context.js';
import type { Lean } from '../types/lean.js';
import { recordAudit } from './audit.service.js';
import { accessibleClientIds } from './compliance.service.js';

export const DOCUMENT_SORT_FIELDS = ['createdAt', 'title', 'documentType'] as const;

export const assertUploadAllowed = (
  filename: string,
  mimeType: string,
  sizeBytes: number,
): void => {
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    throw payloadTooLarge('That file is larger than the 25 MB limit.');
  }
  if (sizeBytes <= 0) {
    throw validationFailed('That file appears to be empty.', [
      { field: 'sizeBytes', message: 'Choose a file with content in it.' },
    ]);
  }
  const extension = extname(filename).replace('.', '').toLowerCase();
  const entry = ALLOWED_UPLOAD_TYPES.find((candidate) => candidate.mimeType === mimeType);
  if (!entry) {
    throw unsupportedMediaType(
      `FirmDesk accepts ${ALLOWED_UPLOAD_EXTENSIONS.join(', ').toUpperCase()} files only.`,
    );
  }
  if (!entry.extensions.includes(extension)) {
    throw unsupportedMediaType(
      `The file name ends in .${extension} but its contents are declared as ${mimeType}. Rename the file or export it again.`,
    );
  }
};

export const presignUpload = async (
  clientId: Types.ObjectId,
  filename: string,
  mimeType: string,
  sizeBytes: number,
): Promise<PresignedUpload> => {
  assertUploadAllowed(filename, mimeType, sizeBytes);
  const key = randomStorageKey(
    `clients/${clientId.toString()}`,
    extname(filename).replace('.', ''),
  );
  return presignPut(key, mimeType, sizeBytes);
};

const verifyStoredObject = async (
  storageKey: string,
  declaredMime: string,
): Promise<{ mimeType: string; sizeBytes: number; checksum: string | null }> => {
  const facts = await headObject(storageKey);
  if (!facts) {
    throw validationFailed('That upload did not arrive. Try uploading the file again.', [
      { field: 'storageKey', message: 'No stored object matches this upload.' },
    ]);
  }
  const actualType = facts.contentType ?? '';
  const actualSize = facts.contentLength ?? 0;
  if (actualType !== declaredMime || actualSize > MAX_UPLOAD_BYTES || actualSize <= 0) {
    await deleteObjects([storageKey]);
    throw unsupportedMediaType(
      'The uploaded file does not match what was declared, so it was discarded. Upload it again.',
    );
  }
  return { mimeType: actualType, sizeBytes: actualSize, checksum: facts.etag ?? null };
};

export interface DocumentListQuery {
  client?: string;
  documentType?: DocumentType;
  complianceItem?: string;
  archived?: boolean;
  q?: string;
  sort?: string;
}

export const buildDocumentFilter = async (
  user: AuthenticatedUser,
  query: DocumentListQuery,
): Promise<QueryFilter<DocumentAttributes>> => {
  const filter: QueryFilter<DocumentAttributes> = { archived: query.archived ?? false };
  const scoped = await accessibleClientIds(user);

  if (query.client) {
    if (scoped !== null && !scoped.some((id) => id.toString() === query.client)) {
      throw notFound('client');
    }
    filter.client = query.client;
  } else {
    if (user.role === 'client') throw notFound('client');
    if (scoped !== null) filter.client = { $in: scoped };
  }

  if (query.documentType) filter.documentType = query.documentType;
  if (query.complianceItem) filter.complianceItem = query.complianceItem;
  if (query.q && query.q.trim().length > 0) {
    filter.title = new RegExp(escapeRegex(query.q.trim()), 'i');
  }
  return filter;
};

export const listDocuments = async (
  user: AuthenticatedUser,
  query: DocumentListQuery,
  page: PageRequest,
): Promise<{ items: Lean<DocumentAttributes>[]; total: number }> => {
  const filter = await buildDocumentFilter(user, query);
  const sort = withTiebreak(
    parseSort<(typeof DOCUMENT_SORT_FIELDS)[number]>(query.sort, DOCUMENT_SORT_FIELDS, {
      createdAt: -1,
    }),
  );
  const [items, total] = await Promise.all([
    DocumentModel.find(filter)
      .sort(sort)
      .skip(page.skip)
      .limit(page.limit)
      .populate('client', 'displayName')
      .lean<Lean<DocumentAttributes>[]>()
      .exec(),
    DocumentModel.countDocuments(filter).exec(),
  ]);
  return { items, total };
};

export const getDocument = async (id: Types.ObjectId): Promise<Lean<DocumentAttributes>> => {
  const record = await DocumentModel.findById(id)
    .populate('client', 'displayName')
    .lean<Lean<DocumentAttributes> | null>()
    .exec();
  if (!record) throw notFound('document');
  return record;
};

export const clientIdOfDocument = async (id: Types.ObjectId): Promise<Types.ObjectId> => {
  const record = await DocumentModel.findById(id).select('client').lean().exec();
  if (!record) throw notFound('document');
  return record.client;
};

export interface FinaliseInput {
  clientId: Types.ObjectId;
  storageKey: string;
  title: string;
  filename: string;
  mimeType: string;
  documentType: DocumentType;
  customTypeLabel?: string | null;
  complianceItemId?: string | null;
  documentRequestId?: string | null;
}

export const finaliseUpload = async (
  input: FinaliseInput,
  user: AuthenticatedUser,
  actor: RequestActor,
): Promise<Lean<DocumentAttributes>> => {
  const facts = await verifyStoredObject(input.storageKey, input.mimeType);

  const created = await DocumentModel.create({
    client: input.clientId,
    title: input.title,
    documentType: input.documentType,
    customTypeLabel: input.customTypeLabel ?? null,
    complianceItem: input.complianceItemId ?? null,
    documentRequest: input.documentRequestId ?? null,
    versions: [
      {
        version: 1,
        storageKey: input.storageKey,
        originalFilename: input.filename,
        mimeType: facts.mimeType,
        sizeBytes: facts.sizeBytes,
        checksum: facts.checksum,
        uploadedBy: user.id,
        uploadedAt: new Date(),
      },
    ],
    currentVersion: 1,
    uploadedByRole: user.role,
    createdBy: user.id,
    updatedBy: user.id,
  });

  await recordAudit({
    actor,
    action: 'create',
    entityKind: 'document',
    entityId: created._id,
    client: input.clientId,
    summary: `Uploaded document ${created.title}`,
  });
  return getDocument(created._id);
};

export const addVersion = async (
  id: Types.ObjectId,
  storageKey: string,
  filename: string,
  mimeType: string,
  user: AuthenticatedUser,
  actor: RequestActor,
): Promise<Lean<DocumentAttributes>> => {
  const doc = await DocumentModel.findById(id).exec();
  if (!doc) throw notFound('document');
  if (doc.archived) throw conflict('This document is archived and read-only.');
  if (doc.versions.length >= MAX_DOCUMENT_VERSIONS) {
    throw conflict(
      `This document already holds ${MAX_DOCUMENT_VERSIONS} versions. Create a new document instead.`,
    );
  }
  const facts = await verifyStoredObject(storageKey, mimeType);
  const nextVersion = doc.versions.length + 1;
  doc.versions.push({
    version: nextVersion,
    storageKey,
    originalFilename: filename,
    mimeType: facts.mimeType,
    sizeBytes: facts.sizeBytes,
    checksum: facts.checksum,
    uploadedBy: user.id,
    uploadedAt: new Date(),
  });
  doc.currentVersion = nextVersion;
  doc.set('updatedBy', user.id);
  await doc.save();

  await recordAudit({
    actor,
    action: 'update',
    entityKind: 'document',
    entityId: doc._id,
    client: doc.client,
    summary: `Uploaded version ${nextVersion} of ${doc.title}`,
  });
  return getDocument(id);
};

export const downloadUrl = async (
  id: Types.ObjectId,
  version: number | undefined,
): Promise<{ url: string; expiresIn: number }> => {
  const doc = await DocumentModel.findById(id).lean<Lean<DocumentAttributes> | null>().exec();
  if (!doc) throw notFound('document');
  const target = doc.versions.find(
    (entry) => entry.version === (version ?? doc.currentVersion),
  );
  if (!target) throw notFound('version');
  return presignGet(target.storageKey, target.originalFilename);
};

export interface DocumentPatch {
  title?: string;
  documentType?: DocumentType;
  customTypeLabel?: string | null;
  complianceItemId?: string | null;
}

export const updateDocument = async (
  id: Types.ObjectId,
  patch: DocumentPatch,
  actor: RequestActor,
): Promise<Lean<DocumentAttributes>> => {
  const doc = await DocumentModel.findById(id).exec();
  if (!doc) throw notFound('document');
  if (doc.archived) throw conflict('This document is archived and read-only.');
  if (patch.title !== undefined) doc.title = patch.title;
  if (patch.documentType !== undefined) doc.documentType = patch.documentType;
  if (patch.customTypeLabel !== undefined) doc.customTypeLabel = patch.customTypeLabel;
  if (patch.complianceItemId !== undefined) doc.set('complianceItem', patch.complianceItemId);
  doc.set('updatedBy', actor.id);
  await doc.save();
  await recordAudit({
    actor,
    action: 'update',
    entityKind: 'document',
    entityId: doc._id,
    client: doc.client,
    summary: `Updated document ${doc.title}`,
  });
  return getDocument(id);
};

export const setDocumentArchived = async (
  id: Types.ObjectId,
  archived: boolean,
  user: AuthenticatedUser,
  actor: RequestActor,
): Promise<Lean<DocumentAttributes>> => {
  const doc = await DocumentModel.findById(id).exec();
  if (!doc) throw notFound('document');
  if (user.role === 'client' && doc.uploadedByRole !== 'client') {
    throw notFound('document');
  }
  doc.archived = archived;
  doc.archivedAt = archived ? new Date() : null;
  doc.archivedBy = archived ? user.id : null;
  await doc.save();
  await recordAudit({
    actor,
    action: archived ? 'archive' : 'restore',
    entityKind: 'document',
    entityId: doc._id,
    client: doc.client,
    summary: `${archived ? 'Archived' : 'Restored'} document ${doc.title}`,
  });
  return getDocument(id);
};

export const hardDeleteDocument = async (
  id: Types.ObjectId,
  confirmation: string,
  actor: RequestActor,
): Promise<void> => {
  const doc = await DocumentModel.findById(id).exec();
  if (!doc) throw notFound('document');
  if (confirmation !== doc.title) {
    throw validationFailed('Type the document title exactly to confirm this deletion.', [
      { field: 'confirm', message: `Type "${doc.title}" to confirm.` },
    ]);
  }
  const keys = doc.versions.map((version) => version.storageKey);
  const clientId = doc.client;
  const title = doc.title;
  await deleteObjects(keys);
  await doc.deleteOne();
  await recordAudit({
    actor,
    action: 'hard_delete',
    entityKind: 'document',
    entityId: id,
    client: clientId,
    summary: `Deleted document ${title} and all ${keys.length} stored version${keys.length === 1 ? '' : 's'}`,
  });
};
