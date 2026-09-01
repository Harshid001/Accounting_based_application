import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import {
  ALLOWED_MIME_TYPES,
  DOCUMENT_TYPES,
  MAX_DOCUMENT_VERSIONS,
  MAX_UPLOAD_BYTES,
  ROLES,
} from '../lib/enums.js';
import type { DocumentType, Role } from '../lib/enums.js';

export interface DocumentVersionAttributes {
  version: number;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string | null;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
}

export interface DocumentAttributes {
  client: Types.ObjectId;
  title: string;
  documentType: DocumentType;
  customTypeLabel?: string | null;
  complianceItem?: Types.ObjectId | null;
  documentRequest?: Types.ObjectId | null;
  versions: DocumentVersionAttributes[];
  currentVersion: number;
  archived: boolean;
  archivedAt?: Date | null;
  archivedBy?: Types.ObjectId | null;
  uploadedByRole: Role;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentRecord = HydratedDocument<DocumentAttributes>;

const versionSchema = new Schema<DocumentVersionAttributes>(
  {
    version: { type: Number, required: true, min: 1 },
    storageKey: { type: String, required: true, trim: true, maxlength: 300 },
    originalFilename: { type: String, required: true, trim: true, maxlength: 260 },
    mimeType: { type: String, required: true, enum: ALLOWED_MIME_TYPES },
    sizeBytes: { type: Number, required: true, min: 1, max: MAX_UPLOAD_BYTES },
    checksum: { type: String, default: null, maxlength: 200 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false },
);

const documentSchema = new Schema<DocumentAttributes>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'client', required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    documentType: { type: String, enum: DOCUMENT_TYPES, required: true },
    customTypeLabel: { type: String, default: null, trim: true, maxlength: 80 },
    complianceItem: { type: Schema.Types.ObjectId, ref: 'complianceItem', default: null },
    documentRequest: { type: Schema.Types.ObjectId, ref: 'documentRequest', default: null },
    versions: {
      type: [versionSchema],
      default: [],
      validate: {
        validator: (value: DocumentVersionAttributes[]) =>
          value.length >= 1 && value.length <= MAX_DOCUMENT_VERSIONS,
        message: `A document holds between one and ${MAX_DOCUMENT_VERSIONS} versions.`,
      },
    },
    currentVersion: { type: Number, required: true, min: 1 },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    uploadedByRole: { type: String, enum: ROLES, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  },
  { timestamps: true, collection: 'document' },
);

documentSchema.pre('validate', function preValidate() {
  if (this.documentType === 'other' && !this.customTypeLabel) {
    throw new Error('Name the document type when you choose Other.');
  }
  if (this.documentType !== 'other') {
    this.customTypeLabel = null;
  }
  if (!this.versions.some((version) => version.version === this.currentVersion)) {
    throw new Error('The current version must exist in the version list.');
  }
});

documentSchema.index({ client: 1, archived: 1, createdAt: -1 });
documentSchema.index({ complianceItem: 1 }, { sparse: true });
documentSchema.index({ documentRequest: 1 }, { sparse: true });
documentSchema.index({ documentType: 1, client: 1 });
documentSchema.index({ title: 'text' }, { name: 'document_search' });

export const DocumentModel: Model<DocumentAttributes> = model<DocumentAttributes>(
  'document',
  documentSchema,
);
