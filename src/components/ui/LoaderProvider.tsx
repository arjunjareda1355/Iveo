import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Loader, type LoaderSize } from './Loader';

export interface ShowLoaderOptions {
  blocking?: boolean;
  size?: LoaderSize;
  onRetry?: () => void;
}

interface LoaderContextValue {
  showLoader: (options?: ShowLoaderOptions) => () => void;
  hideLoader: () => void;
  isActive: boolean;
  isVisible: boolean;
}

const SHOW_DELAY_MS = 300;
const MIN_VISIBLE_MS = 600;
const FADE_MS = 180;
const TIMEOUT_MS = 15_000;

const LoaderContext = createContext<LoaderContextValue | null>(null);

// Imperative bridge so non-React modules (e.g. central apiFetch wrapper) can ref-count the single root overlay
type Bridge = {
  showLoader: (options?: ShowLoaderOptions) => () => void;
  hideLoader: () => void;
};
let globalBridge: Bridge | null = null;

export function showGlobalLoader(options?: ShowLoaderOptions): () => void {
  if (!globalBridge) return () => {};
  return globalBridge.showLoader(options);
}

export function hideGlobalLoader(): void {
  globalBridge?.hideLoader();
}

export const LoaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const countRef = useRef(0);
  const shownAtRef = useRef<number | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryHandlerRef = useRef<(() => void) | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [fadingIn, setFadingIn] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [size, setSize] = useState<LoaderSize>('md');

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    showTimerRef.current = null;
    hideTimerRef.current = null;
    unmountTimerRef.current = null;
    timeoutTimerRef.current = null;
  }, []);

  const startOverlayVisibility = useCallback(() => {
    shownAtRef.current = Date.now();
    setTimedOut(false);
    setMounted(true);
    requestAnimationFrame(() => {
      setFadingIn(true);
    });

    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    timeoutTimerRef.current = setTimeout(() => {
      if (countRef.current > 0) {
        setTimedOut(true);
      }
    }, TIMEOUT_MS);
  }, []);

  const hideLoader = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
    if (countRef.current > 0) return;

    setIsActive(false);

    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }

    if (shownAtRef.current === null) {
      // Completed before 300ms delay expired — never flash
      setFadingIn(false);
      setMounted(false);
      setTimedOut(false);
      setBlocking(false);
      return;
    }

    const elapsed = Date.now() - shownAtRef.current;
    const waitMs = Math.max(0, MIN_VISIBLE_MS - elapsed);

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      if (countRef.current > 0) return;
      setFadingIn(false);
      unmountTimerRef.current = setTimeout(() => {
        unmountTimerRef.current = null;
        if (countRef.current > 0) return;
        shownAtRef.current = null;
        setMounted(false);
        setTimedOut(false);
        setBlocking(false);
      }, FADE_MS);
    }, waitMs);
  }, []);

  const showLoader = useCallback(
    (options?: ShowLoaderOptions) => {
      countRef.current += 1;
      setIsActive(true);

      if (options?.blocking) {
        setBlocking(true);
        setSize(options.size || 'lg');
      } else if (countRef.current === 1) {
        setBlocking(false);
        setSize(options?.size || 'md');
      }
      if (options?.onRetry) {
        retryHandlerRef.current = options.onRetry;
      }

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (unmountTimerRef.current) {
        clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }

      if (shownAtRef.current !== null) {
        setFadingIn(true);
      } else if (!showTimerRef.current) {
        showTimerRef.current = setTimeout(() => {
          showTimerRef.current = null;
          if (countRef.current > 0) {
            startOverlayVisibility();
          }
        }, SHOW_DELAY_MS);
      }

      let released = false;
      return () => {
        if (released) return;
        released = true;
        hideLoader();
      };
    },
    [hideLoader, startOverlayVisibility]
  );

  useEffect(() => {
    globalBridge = { showLoader, hideLoader };
    return () => {
      if (globalBridge?.showLoader === showLoader) {
        globalBridge = null;
      }
      clearTimers();
    };
  }, [showLoader, hideLoader, clearTimers]);

  const handleRetry = () => {
    setTimedOut(false);
    const fn = retryHandlerRef.current;
    if (fn) {
      fn();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const value = useMemo(
    () => ({
      showLoader,
      hideLoader,
      isActive,
      isVisible: mounted && fadingIn,
    }),
    [showLoader, hideLoader, isActive, mounted, fadingIn]
  );

  return (
    <LoaderContext.Provider value={value}>
      {children}
      {mounted && (
        <div
          id="iveo-global-loader-overlay"
          role="status"
          aria-live="polite"
          aria-busy={isActive ? 'true' : 'false'}
          className={`fixed inset-0 z-30 flex items-center justify-center transition-opacity duration-[180ms] ease-out ${
            fadingIn ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            backgroundColor: 'transparent',
            pointerEvents: blocking || timedOut ? 'auto' : 'none',
          }}
        >
          {timedOut ? (
            <div className="pointer-events-auto flex flex-col items-center gap-2 rounded-[12px] border border-border bg-surface px-4 py-3 text-center shadow-sm text-ink">
              <p className="text-[13px] font-medium">Taking longer than expected</p>
              <button
                type="button"
                onClick={handleRetry}
                className="h-8 rounded-[8px] bg-ink px-3 text-[12px] font-medium text-white cursor-pointer hover:opacity-90"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="text-ink/70">
              <Loader size={blocking ? 'lg' : size} label="Loading" />
            </div>
          )}
        </div>
      )}
    </LoaderContext.Provider>
  );
};

export function useLoader(): LoaderContextValue {
  const ctx = useContext(LoaderContext);
  if (!ctx) {
    return {
      showLoader: () => () => {},
      hideLoader: () => {},
      isActive: false,
      isVisible: false,
    };
  }
  return ctx;
}
