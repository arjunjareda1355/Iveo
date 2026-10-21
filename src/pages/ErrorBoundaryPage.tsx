import React from 'react';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { copy } from '../content/copy';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundaryPage extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) {
    // Log nothing sensitive
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-md bg-surface border border-border rounded-[14px] p-8 shadow-[0_1px_2px_rgba(10,10,10,0.04)] flex flex-col items-center">
            <Logo tone="light" size="lg" />

            <h1 className="mt-6 text-[24px] font-semibold text-ink leading-tight">
              {copy.errors.boundaryHeading}
            </h1>

            <p className="mt-3 text-[15px] text-muted leading-relaxed">
              Reload the page to continue. If it keeps happening, email{' '}
              <a
                href="mailto:help@iveo.site"
                className="text-ink underline underline-offset-[3px] font-medium"
              >
                help@iveo.site
              </a>
              .
            </p>

            <div className="mt-8 w-full flex flex-col gap-3">
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={() => window.location.reload()}
              >
                {copy.errors.reload}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
