import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkRoot } from './auth/ClerkRoot';
import { IveoSessionProvider } from './auth/useIvioSession';
import { ToastProvider } from './components/ui/Toast';
import { LoaderProvider } from './components/ui/LoaderProvider';
import { UpgradeDialogProvider } from './components/plan/UpgradeDialogProvider';
import { ErrorBoundaryPage } from './pages/ErrorBoundaryPage';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundaryPage>
        <ClerkRoot>
          <IveoSessionProvider>
            <LoaderProvider>
              <ToastProvider>
                <UpgradeDialogProvider>
                  <App />
                </UpgradeDialogProvider>
              </ToastProvider>
            </LoaderProvider>
          </IveoSessionProvider>
        </ClerkRoot>
      </ErrorBoundaryPage>
    </BrowserRouter>
  </StrictMode>
);
