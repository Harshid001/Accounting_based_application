export function SkipLink() {
  return (
    <a
      href="#main-content"
      data-slot="skip-link"
      data-print="hide"
      className="sr-only rounded-md bg-[var(--fd-accent)] px-4 py-2 text-base font-medium text-[var(--fd-accent-contrast)] focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[70]"
    >
      Skip to main content
    </a>
  );
}

export function RouteAnnouncer() {
  return (
    <div
      id="route-announcer"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  );
}
