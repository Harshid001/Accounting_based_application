import { useQueryClient } from '@tanstack/react-query';
import { LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { signOutEverywhere } from '@/api/authClient';
import { setActiveClientHeader } from '@/api/client';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { ROLE_LABELS } from '@/lib/constants';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';

export interface AccountMenuProps {
  profilePath: string;
}

export function AccountMenu({ profilePath }: AccountMenuProps) {
  const { user, clear } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { errorToast } = useToast();

  if (user === null) return null;

  const signOut = (): void => {
    void signOutEverywhere()
      .then(() => {
        setActiveClientHeader(null);
        clear();
        queryClient.clear();
        void navigate('/sign-in', { replace: true });
      })
      .catch((error: unknown) => {
        errorToast(error, 'Signing out did not finish');
      });
  };

  return (
    <DropdownMenu
      ariaLabel={`Account menu for ${user.name}`}
      actions={[
        {
          id: 'profile',
          label: 'Your profile',
          icon: <User size={14} aria-hidden="true" />,
          onSelect: () => {
            void navigate(profilePath);
          },
        },
        {
          id: 'sign-out',
          label: 'Sign out',
          icon: <LogOut size={14} aria-hidden="true" />,
          separatorBefore: true,
          onSelect: signOut,
        },
      ]}
      trigger={
        <button
          type="button"
          aria-label={`Account menu for ${user.name}`}
          className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-[var(--fd-surface-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fd-focus-ring)]"
        >
          <Avatar name={user.name} image={user.image} size="md" />
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block truncate text-xs font-medium text-[var(--fd-text-primary)]">
              {user.name}
            </span>
            <span className="text-2xs block text-[var(--fd-text-tertiary)]">
              {ROLE_LABELS[user.role]}
            </span>
          </span>
        </button>
      }
    />
  );
}
