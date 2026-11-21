import React from 'react';
import { Loader } from '../components/ui/Loader';

export const AuthSplash: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-bg z-50 flex flex-col items-center justify-center text-ink">
      <Loader size="lg" label="Loading iveo" />
    </div>
  );
};
