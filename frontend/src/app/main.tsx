import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import 'inter-ui/inter-variable-latin.css';
import '@/styles/index.css';

import { renderBootError } from '@/app/bootError';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('FirmDesk could not start: the #root element is missing from index.html.');
}

void import('@/app/App')
  .then(({ App }) => {
    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    renderBootError(container, error);
  });
