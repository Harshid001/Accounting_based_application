import type { HydratedDocument, Model, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

import { PHONE_PATTERN } from '../lib/identifiers.js';
import { ROLES, USER_STATUSES } from '../lib/enums.js';
import type { Role, UserStatus } from '../lib/enums.js';

export interface NotificationPreferences {
  emailOnAssignment: boolean;
  emailDeadlineReminders: boolean;
  emailDailyDigest: boolean;
}

export interface UserAttributes {
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: Role;
  status: UserStatus;
  phone?: string | null;
  linkedClients: Types.ObjectId[];
  pinnedClients: Types.ObjectId[];
  notificationPreferences: NotificationPreferences;
  lastSeenAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserAttributes>;

const notificationPreferencesSchema = new Schema<NotificationPreferences>(
  {
    emailOnAssignment: { type: Boolean, default: true },
    emailDeadlineReminders: { type: Boolean, default: true },
    emailDailyDigest: { type: Boolean, default: true },
  },
  { _id: false },
);

const userSchema = new Schema<UserAttributes>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: null, trim: true, maxlength: 2048 },
    role: { type: String, enum: ROLES, default: 'client', required: true },
    status: { type: String, enum: USER_STATUSES, default: 'active', required: true },
    phone: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator: (value: string | null) => value === null || PHONE_PATTERN.test(value),
        message: 'Enter a 10-digit Indian mobile number or a number in +91 form.',
      },
    },
    linkedClients: { type: [Schema.Types.ObjectId], ref: 'client', default: [] },
    pinnedClients: { type: [Schema.Types.ObjectId], ref: 'client', default: [] },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({
        emailOnAssignment: true,
        emailDeadlineReminders: true,
        emailDailyDigest: true,
      }),
    },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'user', minimize: false },
);

userSchema.pre('validate', function preValidate() {
  if (this.role !== 'client' && this.linkedClients.length > 0) {
    this.linkedClients = [];
  }
});

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, status: 1, name: 1 });
userSchema.index({ linkedClients: 1 });
userSchema.index({ role: 1, emailVerified: 1, createdAt: 1 });

export const User: Model<UserAttributes> = model<UserAttributes>('user', userSchema);
