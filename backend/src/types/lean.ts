import { Types } from 'mongoose';

export type Lean<T> = T & { _id: Types.ObjectId };

export type Ref<T> = Types.ObjectId | Lean<T>;

export const isPopulated = <T>(value: Ref<T> | null | undefined): value is Lean<T> =>
  value !== null && value !== undefined && !(value instanceof Types.ObjectId);

export const refId = <T>(value: Ref<T> | null | undefined): Types.ObjectId | null => {
  if (value === null || value === undefined) return null;
  return isPopulated(value) ? value._id : value;
};

export const refIdString = <T>(value: Ref<T> | null | undefined): string | null => {
  const id = refId(value);
  return id === null ? null : id.toString();
};
