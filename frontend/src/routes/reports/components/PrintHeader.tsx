import { useQuery } from '@tanstack/react-query';

import { fetchFirmSettings } from '@/api/settings.api';
import { queryKeys } from '@/api/queryKeys';
import { formatDateTime } from '@/lib/date';

export interface PrintHeaderProps {
  title: string;
  activeFilters: readonly string[];
}

export function PrintHeader({ title, activeFilters }: PrintHeaderProps) {
  const settings = useQuery({
    queryKey: queryKeys.settings.firm,
    queryFn: fetchFirmSettings,
    staleTime: 10 * 60_000,
  });

  return (
    <div data-print="show" className="mb-4 hidden border-b border-black pb-2 print:block">
      <p className="text-lg font-semibold">{settings.data?.firmName ?? 'FirmDesk'}</p>
      <p className="text-base">{title}</p>
      <p className="text-xs">
        {activeFilters.length === 0 ? 'No filters applied' : `Filters: ${activeFilters.join(' · ')}`}
      </p>
      <p className="text-xs">Generated {formatDateTime(new Date())} IST</p>
    </div>
  );
}
