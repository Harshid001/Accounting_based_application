import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import { FREQUENCIES } from '../lib/enums.js';
import type { Frequency } from '../lib/enums.js';

export interface ClientServiceAttributes {
  client: Types.ObjectId;
  complianceType: Types.ObjectId;
  frequency?: Frequency | null;
  startDate: Date;
  endDate?: Date | null;
  assignedStaff?: Types.ObjectId | null;
  active: boolean;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ClientServiceDocument = HydratedDocument<ClientServiceAttributes>;

const clientServiceSchema = new Schema<ClientServiceAttributes>(
  {
    client: { type: Schema.Types.ObjectId, ref: 'client', required: true },
    complianceType: { type: Schema.Types.ObjectId, ref: 'complianceType', required: true },
    frequency: { type: String, enum: [...FREQUENCIES, null], default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    assignedStaff: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'user', default: null },
  },
  { timestamps: true, collection: 'clientService' },
);

clientServiceSchema.pre('validate', function preValidate() {
  if (this.endDate && this.endDate.getTime() <= this.startDate.getTime()) {
    throw new Error('The end date must fall after the start date.');
  }
});

clientServiceSchema.index({ client: 1, complianceType: 1 }, { unique: true });
clientServiceSchema.index({ active: 1, startDate: 1 });
clientServiceSchema.index({ complianceType: 1 });
clientServiceSchema.index({ assignedStaff: 1 });

export const ClientService: Model<ClientServiceAttributes> = model<ClientServiceAttributes>(
  'clientService',
  clientServiceSchema,
);
