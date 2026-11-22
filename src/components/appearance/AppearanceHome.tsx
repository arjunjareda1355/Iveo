import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Info,
  LayoutPanelTop,
  MoreHorizontal,
  RectangleHorizontal,
  Redo2,
  RotateCcw,
  Sparkles,
  Type,
  Undo2,
  Wand2,
  X,
} from 'lucide-react';
import { useAppearance } from './AppearanceContext';
import { MyThemesModal } from './MyThemesModal';
import { Toggle } from '../ui/Toggle';
import { ProBadge } from '../plan/ProBadge';
import { findCatalogVibe } from '../../lib/appearance/catalog/vibes';
import { findCatalogBackground } from '../../lib/appearance/catalog/backgrounds';
import { findCatalogFont } from '../../lib/appearance/catalog/fonts';
import { CATALOG_SURFACES } from '../../lib/appearance/catalog/surfaces';

interface RowMeta {
  id: 'vibe' | 'background' | 'typography' | 'buttons' | 'layout';
  title: string;
  subtitle: string;
  info: string;
  to: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  isProActive: boolean;
}

export const AppearanceHome: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    draft,
    resolved,
    homeSummary,
    isPro,
    canUndo,
    canRedo,
    undo,
    redo,
    resetEverything,
    surpriseMe,
    snackbar,
    dismissSnackbar,
    hideFooterMark,
    toggleHideFooterMark,
    saveStatus,
    retrySave,
  } = useAppearance();

  const [menuOpen, setMenuOpen] = useState(false);
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [themesOpen, setThemesOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const demoSearch = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === '1' || params.get('autostart') === '1') {
      return location.search;
    }
    return '';
  }, [location.search]);

  useEffect(() => {
    if (!menuOpen && !openInfoId) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuOpen && menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
      if (openInfoId && !(e.target as HTMLElement)?.closest('[data-info-wrap]')) {
        setOpenInfoId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen, openInfoId]);

  const activeVibe = findCatalogVibe(draft.vibeId);
  const activeBgPreset =
    draft.background.type === 'preset' ? findCatalogBackground(draft.background.id) : null;
  const activeSurface = CATALOG_SURFACES.find((s) => s.id === draft.buttons.surface);
  const hasProFont =
    findCatalogFont(draft.typography.name.family)?.tier === 'pro' ||
    findCatalogFont(draft.typography.bio.family)?.tier === 'pro' ||
    findCatalogFont(draft.typography.button.family)?.tier === 'pro';

  const rows: RowMeta[] = [
    {
      id: 'vibe',
      title: 'Vibe',
      subtitle: homeSummary.vibeSubtitle,
      info: 'A vibe sets a starting look for your whole page. You can change anything afterwards.',
      to: `/dashboard/appearance/vibe${demoSearch}`,
      icon: Sparkles,
      isProActive: !isPro && activeVibe?.tier === 'pro',
    },
    {
      id: 'background',
      title: 'Background',
      subtitle: homeSummary.backgroundSubtitle,
      info: 'Choose what sits behind your links. Buttons can match it automatically.',
      to: `/dashboard/appearance/background${demoSearch}`,
      icon: ImageIcon,
      isProActive:
        !isPro &&
        (draft.background.type === 'image' ||
          activeBgPreset?.tier === 'pro' ||
          (draft.background.type === 'preset' && Boolean(draft.background.animate))),
    },
    {
      id: 'typography',
      title: 'Typography',
      subtitle: homeSummary.typographySubtitle,
      info: 'Choose fonts for your name, bio and buttons. Ideas are matched to your vibe.',
      to: `/dashboard/appearance/typography${demoSearch}`,
      icon: Type,
      isProActive: !isPro && hasProFont,
    },
    {
      id: 'buttons',
      title: 'Buttons',
      subtitle: homeSummary.buttonsSubtitle,
      info: 'Pick your own colours or tap an idea built for readability on your background.',
      to: `/dashboard/appearance/buttons${demoSearch}`,
      icon: RectangleHorizontal,
      isProActive: !isPro && activeSurface?.tier === 'pro',
    },
    {
      id: 'layout',
      title: 'Layout & effects',
      subtitle: homeSummary.layoutSubtitle,
      info: 'Set how your header, links and page are arranged cleanly across mobile and desktop.',
      to: `/dashboard/appearance/layout${demoSearch}`,
      icon: LayoutPanelTop,
      isProActive: false,
    },
  ];

  const renderRightAccessory = (rowId: RowMeta['id']) => {
    if (rowId === 'vibe') {
      return (
        <span className="inline-flex items-center -space-x-1 shrink-0" aria-hidden="true">
          {homeSummary.vibeDots.map((hex, i) => (
            <span
              key={i}
              className="w-3.5 h-3.5 rounded-full border border-white shadow-xs"
              style={{ backgroundColor: hex }}
            />
          ))}
        </span>
      );
    }
    if (rowId === 'background') {
      const thumbBg =
        draft.background.type === 'image'
          ? `url(${draft.background.assetId}) center/cover no-repeat`
          : resolved.pageBg;
      return (
        <span
          aria-hidden="true"
          className="w-7 h-7 rounded-lg border border-border shrink-0 shadow-2xs"
          style={{ background: thumbBg }}
        />
      );
    }
    if (rowId === 'typography') {
      return (
        <span
          aria-hidden="true"
          className="text-[16px] font-semibold text-ink shrink-0 w-7 text-center"
          style={{ fontFamily: resolved.typography.name.cssFamily }}
        >
          Aa
        </span>
      );
    }
    if (rowId === 'buttons') {
      return (
        <span
          aria-hidden="true"
          className="h-5 w-11 border shrink-0"
          style={{
            backgroundColor: String(
              resolved.buttons.fill === 'transparent' ? 'transparent' : resolved.buttons.fill
            ),
            borderColor: String(resolved.buttons.border || resolved.pageText),
            borderRadius: `${Math.min(10, resolved.buttons.derivedRadius)}px`,
          }}
        />
      );
    }
    // layout glyph
    return (
      <span
        aria-hidden="true"
        className="w-7 h-7 rounded-lg border border-border bg-surface-2 flex flex-col items-center justify-center gap-0.5 p-1 shrink-0"
      >
        <span className="w-2 h-2 rounded-full bg-ink/70" />
        <span className="w-4 h-1 rounded-full bg-ink/40" />
        <span className="w-4 h-1 rounded-full bg-ink/40" />
      </span>
    );
  };

  return (
    <div className="w-full flex flex-col gap-5 pb-12">
      {/* Top App Bar */}
      <div className="flex items-center justify-between gap-2 min-h-[44px]">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={() => navigate(`/dashboard${demoSearch}`)}
            aria-label="Back to links"
            className="w-11 h-11 min-w-[44px] min-h-[44px] -ml-2 inline-flex items-center justify-center rounded-full text-ink hover:bg-surface-2 transition-colors cursor-pointer md:hidden"
          >
            <ChevronLeft size={22} strokeWidth={1.75} />
          </button>
          <h1 className="text-[20px] font-semibold text-ink tracking-tight truncate">
            Appearance
          </h1>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {saveStatus === 'error' && (
            <button
              type="button"
              onClick={() => void retrySave()}
              className="px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12px] font-medium cursor-pointer"
            >
              Not saved. Retry
            </button>
          )}

          <button
            type="button"
            disabled={!canUndo}
            onClick={() => void undo()}
            aria-label="Undo change"
            title="Undo"
            className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full text-ink hover:bg-surface-2 disabled:opacity-35 transition-colors cursor-pointer"
          >
            <Undo2 size={19} strokeWidth={1.75} />
          </button>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Appearance options"
              aria-expanded={menuOpen}
              className="w-11 h-11 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full text-ink hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <MoreHorizontal size={20} strokeWidth={1.75} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-12 z-40 w-52 rounded-[14px] border border-border bg-surface py-1.5 shadow-lg text-[13px]"
              >
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
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setThemesOpen(true);
                  }}
                  className="w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 text-ink hover:bg-surface-2 cursor-pointer"
                >
                  <Bookmark size={15} />
                  <span>My themes</span>
                </button>
                <div className="my-1 border-t border-divider" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmResetOpen(true);
                  }}
                  className="w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <RotateCcw size={15} />
                  <span>Reset everything</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two Quick Actions: Surprise me & My themes */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={surpriseMe}
          className="h-11 px-4 rounded-xl border border-border bg-surface hover:bg-surface-2 text-ink text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
        >
          <Wand2 size={16} strokeWidth={1.75} />
          <span>Surprise me</span>
        </button>

        <button
          type="button"
          onClick={() => setThemesOpen(true)}
          className="h-11 px-4 rounded-xl border border-border bg-surface hover:bg-surface-2 text-ink text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
        >
          <Bookmark size={16} strokeWidth={1.75} />
          <span>My themes</span>
        </button>
      </div>

      {/* Minimal Five-Row Navigation List (Section 6.2) */}
      <div className="rounded-[20px] border border-[#E6E6E6] bg-white divide-y divide-[#EEF0F2]">
        {rows.map((row) => {
          const Icon = row.icon;
          const isInfoShown = openInfoId === row.id;
          return (
            <div key={row.id} className="relative flex items-center">
              <Link
                to={row.to}
                className="flex-1 min-w-0 min-h-[72px] px-4 py-3 flex items-center gap-3.5 hover:bg-surface-2/60 transition-colors rounded-[20px] focus-visible:outline-2 focus-visible:outline-ink"
              >
                <span className="w-10 h-10 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-ink shrink-0">
                  <Icon size={19} strokeWidth={1.75} />
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-semibold text-ink leading-tight">
                      {row.title}
                    </span>
                    {row.isProActive && <ProBadge locked />}
                  </div>
                  <p className="text-[14px] text-muted truncate mt-0.5">{row.subtitle}</p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {renderRightAccessory(row.id)}
                  <ChevronRight size={18} strokeWidth={1.75} className="text-muted" />
                </div>
              </Link>

              {/* Optional (i) popover trigger positioned cleanly */}
              <div data-info-wrap className="pr-2 relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenInfoId(isInfoShown ? null : row.id);
                  }}
                  aria-label={`About ${row.title}`}
                  className="w-9 h-9 inline-flex items-center justify-center rounded-full text-muted/75 hover:text-ink hover:bg-surface-2 cursor-pointer"
                >
                  <Info size={16} strokeWidth={1.75} />
                </button>
                {isInfoShown && (
                  <div
                    role="dialog"
                    className="absolute right-2 top-11 z-40 w-64 rounded-[14px] border border-border bg-surface p-3 shadow-lg text-[12px] text-ink leading-snug"
                  >
                    {row.info}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preserved Page Footer Branding Toggle */}
      <div className="rounded-[20px] border border-[#E6E6E6] bg-white p-4 flex items-center justify-between gap-4">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-medium text-ink">
              Remove iveo branding
            </span>
            {!isPro && <ProBadge locked />}
          </div>
          <p className="text-[13px] text-muted mt-0.5">
            Hides the iveo mark in your page footer. The report link always stays.
          </p>
        </div>

        <Toggle
          checked={hideFooterMark}
          onChange={() => void toggleHideFooterMark()}
          ariaLabel="Remove iveo branding"
          locked={!isPro}
        />
      </div>

      {/* Reset Everything Confirmation Dialog */}
      {confirmResetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Reset appearance confirmation"
        >
          <div className="w-full max-w-sm rounded-[20px] bg-surface border border-border p-5 shadow-xl">
            <h2 className="text-[16px] font-semibold text-ink">Reset everything?</h2>
            <p className="text-[13px] text-muted mt-1.5">
              This restores Porcelain defaults across Vibe, Background, Typography, Buttons and Layout. You can still Undo.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="h-10 px-4 rounded-xl border border-border text-[13px] font-medium text-ink hover:bg-surface-2 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmResetOpen(false);
                  resetEverything();
                }}
                className="h-10 px-4 rounded-xl bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700 cursor-pointer"
              >
                Reset all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar on Home */}
      {snackbar && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[92vw] bg-ink text-white rounded-full px-4 py-2.5 shadow-xl flex items-center gap-3 text-[13px] font-medium"
        >
          <span>{snackbar.message}</span>
          {snackbar.actionLabel && snackbar.onAction && (
            <button
              type="button"
              onClick={snackbar.onAction}
              className="text-sky-300 hover:text-sky-200 font-semibold cursor-pointer"
            >
              {snackbar.actionLabel}
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

      <MyThemesModal isOpen={themesOpen} onClose={() => setThemesOpen(false)} />
    </div>
  );
};
