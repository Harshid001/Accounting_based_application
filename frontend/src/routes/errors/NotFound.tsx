import { Link } from 'react-router-dom';

import { AuthCard } from '@/routes/auth/components/AuthCard';
import { useSession } from '@/context/SessionContext';
import { homePathFor } from '@/lib/permissions';
import { usePageTitle } from '@/hooks/usePageTitle';

export function NotFound() {
  usePageTitle('Page not found');
  const { user } = useSession();

  return (
    <AuthCard
      title="We could not find that page"
      description="The address may have changed, or the record it pointed at no longer exists."
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
        Check the link you followed. If it came from someone at your firm, ask them to send it
        again.
      </p>
    </AuthCard>
  );
}
