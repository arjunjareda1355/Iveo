import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

interface ToastContextType {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setToastMessage(message);

    timeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      timeoutRef.current = null;
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none select-none transition-opacity duration-200 ease-out motion-reduce:transition-none"
        >
          <div className="bg-[#0A0A0A] text-white text-[14px] font-medium px-4 py-2.5 rounded-full shadow-[0_24px_48px_-12px_rgba(10,10,10,0.14),0_2px_6px_rgba(10,10,10,0.05)] border border-[#262626]">
            {toastMessage}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export function useToast(): { showToast: (message: string) => void } {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast: () => {},
    };
  }
  return context;
}
