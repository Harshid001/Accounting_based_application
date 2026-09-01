import { Link } from 'react-router-dom';

import { AuthCard } from '@/routes/auth/components/AuthCard';
import { useSession } from '@/context/SessionContext';
import { homePathFor } from '@/lib/permissions';
import { usePageTitle } from '@/hooks/usePageTitle';

export function Forbidden() {
  usePageTitle('You do not have access');
  const { user } = useSession();

  return (
    <AuthCard
      title="You do not have access to that"
      description="Your account is signed in, but this screen is limited to a role you do not hold."
      footer={
        <Link
          to={homePathFor(user?.role)}
          className="text-[var(--fd-accent)] underline underline-offset-4"
        >
          Go back to your home screen
        </Link>
      }
    >
      <p className="text-base text-[var(--fd-text-secondary)]">
        If you think you should be able to see this, ask an administrator at your firm to check your
        role.
      </p>
    </AuthCard>
  );
}
