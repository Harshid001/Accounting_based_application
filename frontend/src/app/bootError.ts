export const renderBootError = (container: HTMLElement, error: unknown): void => {
  const message =
    error instanceof Error && error.message.length > 0
      ? error.message
      : 'FirmDesk could not start, and no reason was reported.';

  const wrapper = document.createElement('div');
  wrapper.setAttribute('role', 'alert');
  wrapper.style.cssText = [
    'min-height:100dvh',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:2rem',
    'background:#0B0F17',
    'color:#E8EDF4',
    'font-family:ui-sans-serif,system-ui,-apple-system,sans-serif',
  ].join(';');

  const panel = document.createElement('div');
  panel.style.cssText = 'max-width:34rem;text-align:center';

  const heading = document.createElement('h1');
  heading.textContent = 'FirmDesk could not start';
  heading.style.cssText = 'font-size:20px;font-weight:600;margin:0 0 8px';

  const detail = document.createElement('p');
  detail.textContent = message;
  detail.style.cssText = 'font-size:14px;line-height:20px;margin:0;opacity:0.85';

  panel.append(heading, detail);
  wrapper.append(panel);
  container.replaceChildren(wrapper);
};
