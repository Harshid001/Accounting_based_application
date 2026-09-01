import { Card, CardHeader, DefinitionList } from '@/components/ui/card';
import { AadhaarReveal } from '@/routes/clients/tabs/AadhaarReveal';
import { ServicesPanel } from '@/routes/clients/tabs/ServicesPanel';
import { useClientRecord } from '@/routes/clients/ClientRecord';
import { useSession } from '@/context/SessionContext';
import { CLIENT_TYPE_LABELS, ENTITY_TYPE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/date';
import type { Contact } from '@/types/models';

const line = (value: string | null): string => (value === null || value.length === 0 ? '—' : value);

function ContactCard({ contact, label }: { contact: Contact; label: string }) {
  return (
    <div className="rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] p-3">
      <p className="text-2xs mb-1 tracking-wide text-[var(--fd-text-tertiary)] uppercase">
        {label}
      </p>
      <p className="text-base font-medium text-[var(--fd-text-primary)]">{contact.name}</p>
      {contact.role === null ? null : (
        <p className="text-xs text-[var(--fd-text-tertiary)]">{contact.role}</p>
      )}
      <p className="mt-1 text-base break-all text-[var(--fd-text-secondary)]">{contact.email}</p>
      {contact.phone === null ? null : (
        <p className="numeric text-base text-[var(--fd-text-secondary)]">{contact.phone}</p>
      )}
    </div>
  );
}

export function ProfileTab() {
  const { client } = useClientRecord();
  const { allows } = useSession();

  const address = client.address;
  const addressLines = [
    address?.line1,
    address?.line2,
    [address?.city, address?.state].filter(Boolean).join(', '),
    address?.pincode,
  ].filter((part): part is string => typeof part === 'string' && part.length > 0);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Identifiers" />
        <DefinitionList
          items={[
            { label: 'Client type', value: CLIENT_TYPE_LABELS[client.clientType] },
            { label: 'PAN', value: <span className="numeric">{line(client.pan)}</span> },
            ...(client.clientType === 'business'
              ? [
                  { label: 'GSTIN', value: <span className="numeric">{line(client.gstin)}</span> },
                  { label: 'TAN', value: <span className="numeric">{line(client.tan)}</span> },
                  { label: 'CIN', value: <span className="numeric">{line(client.cin)}</span> },
                  {
                    label: 'Entity type',
                    value:
                      client.entityType === null ? '—' : ENTITY_TYPE_LABELS[client.entityType],
                  },
                  {
                    label: 'Incorporated',
                    value: formatDate(client.incorporationDate),
                  },
                ]
              : [
                  { label: 'Date of birth', value: formatDate(client.dateOfBirth) },
                  ...(allows('client:reveal_aadhaar')
                    ? [
                        {
                          label: 'Aadhaar',
                          value: (
                            <AadhaarReveal
                              clientId={client.id}
                              clientName={client.displayName}
                              present={client.aadhaarPresent === true}
                            />
                          ),
                        },
                      ]
                    : []),
                ]),
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Contacts" />
        <div className="grid gap-3 sm:grid-cols-2">
          <ContactCard contact={client.primaryContact} label="Primary contact" />
          {client.additionalContacts.map((contact, index) => (
            <ContactCard
              key={`${contact.email}-${index}`}
              contact={contact}
              label={`Contact ${index + 2}`}
            />
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Address" />
        {addressLines.length === 0 ? (
          <p className="text-base text-[var(--fd-text-tertiary)]">No address on file.</p>
        ) : (
          <address className="text-base whitespace-pre-line not-italic text-[var(--fd-text-primary)]">
            {addressLines.join('\n')}
          </address>
        )}
      </Card>

      <ServicesPanel />

      <Card>
        <CardHeader title="Internal notes" description="Never visible in the client portal." />
        {client.notes === null || client.notes.length === 0 ? (
          <p className="text-base text-[var(--fd-text-tertiary)]">No notes yet.</p>
        ) : (
          <p className="text-base whitespace-pre-wrap text-[var(--fd-text-primary)]">
            {client.notes}
          </p>
        )}
      </Card>
    </div>
  );
}
