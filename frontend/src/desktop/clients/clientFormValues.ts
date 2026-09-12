import { emptyClient } from '@/schemas/client.schema';
import type { ClientFormValues, ContactValues } from '@/schemas/client.schema';
import type { ClientDetail, Contact } from '@/types/models';

const toContact = (contact: Contact): ContactValues => ({
  name: contact.name,
  role: contact.role ?? '',
  email: contact.email,
  phone: contact.phone ?? '',
});

export const clientToFormValues = (client: ClientDetail): ClientFormValues => ({
  ...emptyClient,
  clientType: client.clientType,
  displayName: client.displayName,
  legalName: client.legalName ?? '',
  status: client.status,
  pan: client.pan ?? '',
  aadhaar: '',
  dateOfBirth: client.dateOfBirth ?? '',
  gstin: client.gstin ?? '',
  tan: client.tan ?? '',
  cin: client.cin ?? '',
  entityType: client.entityType ?? '',
  incorporationDate: client.incorporationDate ?? '',
  primaryContact: toContact(client.primaryContact),
  additionalContacts: client.additionalContacts.map(toContact),
  address: {
    line1: client.address?.line1 ?? '',
    line2: client.address?.line2 ?? '',
    city: client.address?.city ?? '',
    state: client.address?.state ?? '',
    pincode: client.address?.pincode ?? '',
  },
  assignedStaff: client.assignedStaff.map((person) => person.id),
  notes: client.notes ?? '',
});
