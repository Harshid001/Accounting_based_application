import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import { DOCUMENT_REQUEST_STATUSES, DOCUMENT_TYPES } from '../lib/enums.js';
import type { DocumentRequestStatus, DocumentType } from '../lib/enums.js';

export interface DocumentRequestAttributes {
  client: Types.ObjectId;
  complianceItem?: Types.ObjectId | null;
  title: string;
  description?: string | null;
  documentType: DocumentType;
  dueDate?: Date | null;
  status: DocumentRequestStatus;
  fulfilledBy?: Types.ObjectId | null;
  fulfilledAt?: Date | null;
  requestedBy?: Types.ObjectId | null;
  lastRemindedAt?: Date | null;
  reminderCount: number;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentRequestDocument = HydratedDocument<DocumentRequestAttributes>;

const documentRequestSchema = new Schema<DocumentRequestAttributes>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'client', required: true },
    complianceItem: { type: Schema.Types.ObjectId, ref: 'complianceItem', default: null },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    description: { type: String, default: null, trim: true, maxlength: 2000 },
    documentType: { type: String, enum: DOCUMENT_TYPES, required: true },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: DOCUMENT_REQUEST_STATUSES, default: 'open', required: true },
    fulfilledBy: { type: Schema.Types.ObjectId, ref: 'document', default: null },
    fulfilledAt: { type: Date, default: null },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    lastRemindedAt: { type: Date, default: null },
    reminderCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  },
  { timestamps: true, collection: 'documentRequest' },
);

documentRequestSchema.pre('validate', function preValidate() {
  if (this.status === 'fulfilled' && !this.fulfilledBy) {
    throw new Error('A fulfilled request must name the document that closed it.');
  }
});

documentRequestSchema.index({ client: 1, status: 1, dueDate: 1 });
documentRequestSchema.index({ complianceItem: 1, status: 1 });

export const DocumentRequest: Model<DocumentRequestAttributes> =
  model<DocumentRequestAttributes>('documentRequest', documentRequestSchema);
