import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Eye,
  Info,
  MoreHorizontal,
  Redo2,
  RotateCcw,
  Undo2,
  X,
} from 'lucide-react';
import { useAppearance, type AppearanceSectionKey } from './AppearanceContext';

interface ExtraMenuItem {
  label: string;
  onSelect: () => void;
  active?: boolean;
}

interface SectionScreenShellProps {
  sectionKey: AppearanceSectionKey;
  title: string;
  infoText: string;
  stickySubHeader?: React.ReactNode;
  extraMenuItems?: readonly ExtraMenuItem[];
  onOpenPreview: () => void;
  children: React.ReactNode;
}

export const SectionScreenShell: React.FC<SectionScreenShellProps> = ({
  sectionKey,
  title,
  infoText,
  stickySubHeader,
  extraMenuItems = [],
  onOpenPreview,
  children,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    canUndo,
    canRedo,
    undo,
    redo,
    resetSection,
    saveStatus,
    retrySave,
    flushSave,
    snackbar,
    dismissSnackbar,
    saveScrollPos,
    getScrollPos,
    trackEvent,
  } = useAppearance();

  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  const demoSearch = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === '1' || params.get('autostart') === '1') {
      return location.search;
    }
    return '';
  }, [location.search]);

  const homeUrl = `/dashboard/appearance${demoSearch}`;

  const goBackHome = async () => {
    saveScrollPos(location.pathname, window.scrollY || 0);
    await flushSave();
    navigate(homeUrl);
  };

  // Analytics & Focus title on mount + restore scroll
  useEffect(() => {
    trackEvent('appearance_section_opened', { section: sectionKey });
    const prevY = getScrollPos(location.pathname);
    if (prevY > 0) {
      window.scrollTo({ top: prevY, behavior: 'auto' });
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    const t = setTimeout(() => {
      titleRef.current?.focus();
    }, 30);
    return () => {
      clearTimeout(t);
      saveScrollPos(location.pathname, window.scrollY || 0);
    };
  }, [sectionKey, location.pathname, getScrollPos, saveScrollPos, trackEvent]);

  // Escape key navigates back
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (infoOpen) {
          setInfoOpen(false);
          return;
        }
        if (menuOpen) {
          setMenuOpen(false);
          return;
        }
        void goBackHome();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Outside click closes popovers
  useEffect(() => {
    if (!infoOpen && !menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (infoOpen && infoRef.current && !infoRef.current.contains(target)) {
        setInfoOpen(false);
      }
      if (menuOpen && menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [infoOpen, menuOpen]);

  return (
    <div className="w-full flex flex-col min-h-[calc(100dvh-11rem)] animate-in md:animate-none">
      <style>{`
        @keyframes iveoPushIn {
          from { opacity: 0.7; transform: translateX(18px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .iveo-section-push {
          animation: iveoPushIn 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes iveoPushIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .iveo-section-push {
            animation-duration: 120ms !important;
          }
        }
      `}</style>

      <div className="iveo-section-push flex-1 flex flex-col">
        {/* Sticky 56px Top Bar */}
        <div className="sticky top-14 md:top-[104px] z-30 bg-bg/95 backdrop-blur-md border-b border-border -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="h-14 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={() => void goBackHome()}
                aria-label="Back to Appearance"
                className="w-11 h-11 min-w-[44px] min-h-[44px] -ml-2 inline-flex items-center justify-center rounded-full text-ink hover:bg-surface-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-ink"
              >
                <ChevronLeft size={22} strokeWidth={1.75} />
              </button>
              <h1
                ref={titleRef}
                tabIndex={-1}
                className="text-[18px] font-semibold text-ink tracking-tight truncate outline-none"
              >
                {title}
              </h1>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {saveStatus === 'error' && (
                <button
                  type="button"
                  onClick={() => void retrySave()}
                  className="px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12px] font-medium hover:bg-red-100 cursor-pointer"
                >
                  Not saved. Retry
                </button>
              )}

              {/* Info Popover */}
              <div ref={infoRef} className="relative">
                <button
                  type="button"
                  onClick={() => setInfoOpen((o) => !o)}
                  aria-label={`About ${title}`}
                  aria-expanded={infoOpen}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <Info size={19} strokeWidth={1.75} />
                </button>
                {infoOpen && (
                  <div
                    role="dialog"
                    aria-label={`${title} info`}
                    className="absolute right-0 top-12 z-40 w-72 rounded-[14px] border border-border bg-surface p-3.5 shadow-lg text-[13px] text-ink leading-snug"
                  >
                    <p>{infoText}</p>
                  </div>
                )}
              </div>

              {/* Overflow Menu */}
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="More options"
                  aria-expanded={menuOpen}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <MoreHorizontal size={20} strokeWidth={1.75} />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-12 z-40 w-56 rounded-[14px] border border-border bg-surface py-1.5 shadow-lg text-[13px]"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!canUndo}
                      onClick={() => {
                        setMenuOpen(false);
                        void undo();
                      }}
                      className="w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 text-ink hover:bg-surface-2 disabled:opacity-40 cursor-pointer"
                    >
                      <Undo2 size={15} />
                      <span>Undo</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!canRedo}
                      onClick={() => {
                        setMenuOpen(false);
                        void redo();
                      }}
                      className="w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 text-ink hover:bg-surface-2 disabled:opacity-40 cursor-pointer"
                    >
                      <Redo2 size={15} />
                      <span>Redo</span>
                    </button>
                    {extraMenuItems.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          item.onSelect();
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center justify-between text-ink hover:bg-surface-2 cursor-pointer"
                      >
                        <span>{item.label}</span>
                        {item.active !== undefined && (
                          <span className="text-[11px] font-semibold text-muted">
                            {item.active ? 'ON' : 'OFF'}
                          </span>
                        )}
                      </button>
                    ))}
                    <div className="my-1 border-t border-divider" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        resetSection(sectionKey);
                      }}
                      className="w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <RotateCcw size={15} />
                      <span>Reset section</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Max ONE sticky secondary row (tabs/search) */}
          {stickySubHeader && <div className="pb-2.5">{stickySubHeader}</div>}
        </div>

        {/* Single Vertical Flow Body (24px group rhythm, zero nested scroll containers) */}
        <div className="flex flex-col gap-6 pt-5 pb-24">
          {children}
        </div>
      </div>

      {/* Dismissible Snackbar above Bottom Bar */}
      {snackbar && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 lg:left-[calc(50%-180px)] z-50 max-w-[92vw] sm:max-w-md w-max bg-ink text-white rounded-full px-4 py-2.5 shadow-xl flex items-center gap-3 text-[13px] font-medium"
        >
          <span>{snackbar.message}</span>
          {snackbar.actionLabel && snackbar.onAction && (
            <button
              type="button"
              onClick={snackbar.onAction}
              className="text-sky-300 hover:text-sky-200 font-semibold cursor-pointer whitespace-nowrap"
            >
              {snackbar.actionLabel}
            </button>
          )}
          {snackbar.secondaryLabel && snackbar.onSecondary && (
            <button
              type="button"
              onClick={snackbar.onSecondary}
              className="text-white/75 hover:text-white font-medium cursor-pointer whitespace-nowrap"
            >
              {snackbar.secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={dismissSnackbar}
            aria-label="Dismiss notification"
            className="text-white/60 hover:text-white cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Sticky 64px Safe-Area Bottom Bar */}
      <div className="fixed bottom-0 inset-x-0 lg:sticky lg:bottom-0 lg:inset-x-auto z-30 h-16 bg-surface/95 backdrop-blur-md border-t border-border px-4 lg:px-0 pb-[env(safe-area-inset-bottom,0px)] flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenPreview}
          className="h-11 px-4 rounded-xl border border-border bg-surface hover:bg-surface-2 text-ink text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
        >
          <Eye size={17} strokeWidth={1.75} />
          <span>Preview</span>
        </button>

        <button
          type="button"
          onClick={() => void goBackHome()}
          className="h-11 px-6 rounded-xl bg-ink hover:bg-ink-2 text-white text-[14px] font-semibold inline-flex items-center justify-center cursor-pointer transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};
