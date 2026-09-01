import type { DocumentAttributes } from '../models/document.model.js';
import type { Lean } from '../types/lean.js';
import { idOf, namedRef, timestamp } from './common.js';
import type { NamedRef } from './common.js';

type DocumentRecord = Lean<DocumentAttributes>;

export interface DocumentVersionView {
  version: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  uploadedAt: string | null;
}

export interface DocumentListRow {
  id: string;
  client: NamedRef | null;
  title: string;
  documentType: string;
  customTypeLabel: string | null;
  currentVersion: number;
  versionCount: number;
  sizeBytes: number;
  originalFilename: string;
  mimeType: string;
  uploadedByRole: string;
  archived: boolean;
  complianceItemId: string | null;
  documentRequestId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const currentVersionOf = (document: DocumentRecord) =>
  document.versions.find((version) => version.version === document.currentVersion) ??
  document.versions[document.versions.length - 1];

export const serialiseDocumentRow = (document: DocumentRecord): DocumentListRow => {
  const current = currentVersionOf(document);
  return {
    id: document._id.toString(),
    client: namedRef(document.client, 'displayName'),
    title: document.title,
    documentType: document.documentType,
    customTypeLabel: document.customTypeLabel ?? null,
    currentVersion: document.currentVersion,
    versionCount: document.versions.length,
    sizeBytes: current?.sizeBytes ?? 0,
    originalFilename: current?.originalFilename ?? '',
    mimeType: current?.mimeType ?? 'application/octet-stream',
    uploadedByRole: document.uploadedByRole,
    archived: document.archived,
    complianceItemId: idOf(document.complianceItem),
    documentRequestId: idOf(document.documentRequest),
    createdAt: timestamp(document.createdAt),
    updatedAt: timestamp(document.updatedAt),
  };
};

export interface DocumentDetail extends DocumentListRow {
  versions: DocumentVersionView[];
}

export const serialiseDocumentDetail = (document: DocumentRecord): DocumentDetail => ({
  ...serialiseDocumentRow(document),
  versions: document.versions
    .map((version) => ({
      version: version.version,
      originalFilename: version.originalFilename,
      mimeType: version.mimeType,
      sizeBytes: version.sizeBytes,
      uploadedBy: version.uploadedBy.toString(),
      uploadedAt: timestamp(version.uploadedAt),
    }))
    .sort((a, b) => b.version - a.version),
});
