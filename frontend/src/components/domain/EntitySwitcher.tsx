import { Building2 } from 'lucide-react';

import { Select } from '@/components/ui/select';
import { useActiveClient } from '@/context/ActiveClientContext';

export function EntitySwitcher() {
  const { clients, activeClientId, setActiveClientId, showSwitcher } = useActiveClient();

  if (!showSwitcher || activeClientId === null) return null;

  return (
    <div className="flex items-center gap-2">
      <Building2 size={15} aria-hidden="true" className="text-[var(--fd-text-tertiary)]" />
      <Select
        className="w-52"
        size="sm"
        ariaLabel="Active entity"
        value={activeClientId}
        onValueChange={setActiveClientId}
        options={clients.map((client) => ({ value: client.id, label: client.displayName }))}
      />
    </div>
  );
}
