import { BrowserRouter } from 'react-router-dom';

import { AppRoutes } from '@/app/router';
import { Providers } from '@/app/providers';
import { RootErrorBoundary } from '@/app/RootErrorBoundary';
import { UpdatePrompt } from '@/app/UpdatePrompt';

export function App() {
  return (
    <RootErrorBoundary>
      <BrowserRouter>
        <Providers>
          <AppRoutes />
          <UpdatePrompt />
        </Providers>
      </BrowserRouter>
    </RootErrorBoundary>
  );
}
