import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkRoot } from './auth/ClerkRoot';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundaryPage } from './pages/ErrorBoundaryPage';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundaryPage>
        <ClerkRoot>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ClerkRoot>
      </ErrorBoundaryPage>
    </BrowserRouter>
  </StrictMode>
);
