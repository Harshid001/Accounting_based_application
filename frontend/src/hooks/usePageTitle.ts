import { useEffect } from 'react';

import { env } from '@/lib/env';

let liveRegion: HTMLElement | null = null;

const announce = (message: string): void => {
  if (liveRegion === null) {
    liveRegion = document.getElementById('route-announcer');
  }
  if (liveRegion !== null) liveRegion.textContent = message;
};

export function usePageTitle(title: string, options: { announce?: boolean } = {}): void {
  const shouldAnnounce = options.announce ?? true;

  useEffect(() => {
    document.title = `${title} · ${env.appName}`;
    if (shouldAnnounce) announce(title);
  }, [title, shouldAnnounce]);
}

export function useFocusHeading(headingId = 'page-title'): void {
  useEffect(() => {
    const heading = document.getElementById(headingId);
    heading?.focus({ preventScroll: true });
  }, [headingId]);
}
