import { Button } from '@/components/ui/button';
import { signOutEverywhere } from '@/api/authClient';
import { useSession } from '@/context/SessionContext';

export function WebPortalRequired() {
  const { clear } = useSession();
  const signOut = async (): Promise<void> => {
    await signOutEverywhere().catch(() => undefined);
    clear();
  };
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--fd-bg)] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-6 text-center shadow-xl">
        <h1 className="text-xl font-semibold text-[var(--fd-text-primary)]">
          Clients use the web portal
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--fd-text-secondary)]">
          This desktop app is for authorized practice staff only. Please open jvaccounting.in in
          your browser to access your client portal.
        </p>
        <Button
          className="mt-6 w-full"
          onClick={() => {
            void signOut();
          }}
        >
          Sign out
        </Button>
      </div>
    </main>
  );
}
