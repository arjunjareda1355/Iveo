import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type {
  Appearance,
  AppearanceLock,
  Background,
  ResolvedTokens,
  ThemePreset,
} from '../../lib/appearance/types';
import { SYSTEM_DEFAULT_APPEARANCE } from '../../lib/appearance/types';
import { resolveTokens, buildAppearanceHomeSummary } from '../../lib/appearance/resolveTokens';
import {
  appearanceToLegacyMirror,
  applyVibeWithScope,
  migrateLegacyProfileToAppearanceV2,
} from '../../lib/appearance/migrate';
import { CATALOG_VIBES, findCatalogVibe, vibeToAppearanceDefaults } from '../../lib/appearance/catalog/vibes';
import { suggestButtons, suggestFonts, suggestLayouts } from '../../lib/color/recipes';
import { analyzeBackground } from '../../lib/color/analyze';
import { deltaE } from '../../lib/color/oklch';
import { buildSuggestionSeed } from '../../lib/color/prng';
import { useIvioSession } from '../../auth/useIvioSession';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';
import { useToast } from '../ui/Toast';
import type { CardLookStyle } from '../../data/types';
import type { VibeId } from '../../lib/vibes';

export interface AppearanceSnackbar {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export type AppearanceSectionKey = 'vibe' | 'background' | 'typography' | 'buttons' | 'layout';

interface AppearanceContextValue {
  draft: Appearance;
  resolved: ResolvedTokens;
  homeSummary: ReturnType<typeof buildAppearanceHomeSummary>;
  isPro: boolean;
  isDemo: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  canUndo: boolean;
  canRedo: boolean;
  themes: ThemePreset[];
  themesLoading: boolean;
  snackbar: AppearanceSnackbar | null;
  advancedExpanded: boolean;
  cardLook: CardLookStyle;
  hideFooterMark: boolean;
  applyPatch: (
    nextOrUpdater: Partial<Appearance> | ((prev: Appearance) => Appearance),
    opts?: {
      coalesce?: boolean;
      snackbarMessage?: string;
      showUndo?: boolean;
      checkBgToneShift?: boolean;
    }
  ) => void;
  applyVibeChoice: (
    vibeId: string,
    scope: 'everything' | 'colors-bg' | 'fonts-layout',
    keepLocks: boolean
  ) => void;
  toggleLock: (lock: AppearanceLock) => void;
  toggleAutoMatchButtons: () => void;
  setAdvancedExpanded: (val: boolean) => void;
  setCardLook: (look: CardLookStyle) => void;
  toggleHideFooterMark: () => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  resetSection: (section: AppearanceSectionKey) => void;
  resetEverything: () => void;
  surpriseMe: () => void;
  retrySave: () => Promise<void>;
  flushSave: () => Promise<void>;
  dismissSnackbar: () => void;
  showAppliedSnackbar: (message?: string) => void;
  loadThemes: () => Promise<void>;
  saveTheme: (name: string) => Promise<{ ok: boolean; error?: string }>;
  applyTheme: (theme: ThemePreset) => void;
  renameTheme: (id: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  deleteTheme: (id: string) => Promise<{ ok: boolean; error?: string }>;
  saveScrollPos: (pathname: string, scrollY: number) => void;
  getScrollPos: (pathname: string) => number;
  trackEvent: (event: string, payload?: Record<string, unknown>) => void;
  hasCustomOverrides: boolean;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function cloneAppearance(a: Appearance): Appearance {
  return JSON.parse(JSON.stringify(a));
}

function areAppearancesEqual(a: Appearance, b: Appearance): boolean {
  return JSON.stringify({ ...a, updatedAt: undefined }) === JSON.stringify({ ...b, updatedAt: undefined });
}

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useIvioSession();
  const location = useLocation();
  const { openUpgrade } = useUpgradeDialog();
  const { showToast } = useToast();

  const isDemo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('demo') === '1' || params.get('autostart') === '1' || !session.userId;
  }, [location.search, session.userId]);

  const initialAppearance = useMemo<Appearance>(() => {
    if (session.appearance && session.appearance.schemaVersion === 2) {
      return cloneAppearance(session.appearance);
    }
    return migrateLegacyProfileToAppearanceV2({
      vibeId: session.vibeId,
      buttonShape: session.buttonShape,
      background: session.background,
      fontSettings: session.fontSettings,
      buttonColors: session.buttonColors,
      layoutSettings: session.layoutSettings,
      onboardingComplete: session.onboardingComplete,
    });
  }, [
    session.appearance,
    session.vibeId,
    session.buttonShape,
    session.background,
    session.fontSettings,
    session.buttonColors,
    session.layoutSettings,
    session.onboardingComplete,
  ]);

  const [draft, setDraft] = useState<Appearance>(initialAppearance);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [undoStack, setUndoStack] = useState<Appearance[]>([]);
  const [redoStack, setRedoStack] = useState<Appearance[]>([]);
  const [themes, setThemes] = useState<ThemePreset[]>(() => {
    try {
      const raw = localStorage.getItem(`iveo_themes_${session.username || 'owner'}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [themesLoading, setThemesLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<AppearanceSnackbar | null>(null);
  const [advancedExpanded, setAdvancedExpandedState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`iveo_appearance_adv_${session.username || 'owner'}`) === '1';
    } catch {
      return false;
    }
  });

  const draftRef = useRef<Appearance>(draft);
  draftRef.current = draft;
  const lastCommittedRef = useRef<Appearance>(initialAppearance);
  const lastUndoPushAtRef = useRef<number>(0);
  const debounceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snackbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const sessionInitIdRef = useRef<string | null>(null);

  // Re-sync draft if user switches account cleanly
  useEffect(() => {
    const key = session.username || session.userId || 'owner';
    if (sessionInitIdRef.current !== key) {
      sessionInitIdRef.current = key;
      setDraft(initialAppearance);
      lastCommittedRef.current = initialAppearance;
      setUndoStack([]);
      setRedoStack([]);
    }
  }, [session.username, session.userId, initialAppearance]);

  const trackEvent = useCallback((event: string, payload?: Record<string, unknown>) => {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(
        new CustomEvent('iveo:appearance:event', {
          detail: { event, ...(payload || {}), ts: Date.now() },
        })
      );
    } catch {}
  }, []);

  const dismissSnackbar = useCallback(() => {
    if (snackbarTimerRef.current) clearTimeout(snackbarTimerRef.current);
    setSnackbar(null);
  }, []);

  const presentSnackbar = useCallback((next: Omit<AppearanceSnackbar, 'id'>, durationMs = 5000) => {
    if (snackbarTimerRef.current) clearTimeout(snackbarTimerRef.current);
    const id = Date.now() + Math.random();
    setSnackbar({ ...next, id });
    snackbarTimerRef.current = setTimeout(() => {
      setSnackbar((curr) => (curr?.id === id ? null : curr));
    }, durationMs);
  }, []);

  const persistAppearanceNow = useCallback(
    async (targetAppearance: Appearance) => {
      const mirror = appearanceToLegacyMirror(targetAppearance, session.layoutSettings);
      const stamped: Appearance = {
        ...targetAppearance,
        updatedAt: new Date().toISOString(),
      };

      setSaveStatus('saving');
      try {
        // Optimistically sync legacy mirror + appearance to session hook (handles localStorage + Firestore + BroadcastChannel)
        await session.updatePreferences({
          vibeId: targetAppearance.vibeId as VibeId,
          buttonShape: mirror.buttonShape,
          buttonColors: mirror.buttonColors,
          fontSettings: mirror.fontSettings,
          layoutSettings: mirror.layoutSettings,
          appearance: stamped,
        });

        // If authenticated (non-demo), also PATCH /api/appearance for server-side history, validation & Pro enforcement
        if (!isDemo && session.userId && session.username) {
          const res = await fetch('/api/appearance', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': session.userId,
              'x-iveo-username': session.username,
              ...(session.primaryEmail ? { 'x-user-email': session.primaryEmail } : {}),
            },
            body: JSON.stringify({
              username: session.username,
              patch: stamped,
              ifUpdatedAt: lastCommittedRef.current.updatedAt,
            }),
          });

          if (res.status === 402) {
            const body = await res.json().catch(() => ({}));
            const prevSafe = cloneAppearance(lastCommittedRef.current);
            setDraft(prevSafe);
            setSaveStatus('idle');
            trackEvent('pro_gate_hit', { fields: body.fields || [] });
            openUpgrade();
            return;
          }

          if (res.status === 409) {
            const body = await res.json().catch(() => ({}));
            const latest = body?.appearance || body?.latest;
            if (latest) {
              const merged = {
                ...latest,
                ...stamped,
                updatedAt: latest.updatedAt || stamped.updatedAt,
              };
              lastCommittedRef.current = cloneAppearance(merged);
              setDraft(merged);
              setSaveStatus('saved');
              return;
            }
          }

          if (!res.ok) {
            throw new Error(`HTTP_${res.status}`);
          }

          const json = await res.json().catch(() => null);
          if (json?.appearance) {
            lastCommittedRef.current = cloneAppearance(json.appearance);
          } else {
            lastCommittedRef.current = cloneAppearance(stamped);
          }
        } else {
          lastCommittedRef.current = cloneAppearance(stamped);
        }

        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    },
    [session, isDemo, openUpgrade, trackEvent]
  );

  const scheduleAutosave = useCallback(
    (nextAppearance: Appearance) => {
      if (debounceSaveTimerRef.current) clearTimeout(debounceSaveTimerRef.current);
      setSaveStatus('saving');
      debounceSaveTimerRef.current = setTimeout(() => {
        debounceSaveTimerRef.current = null;
        void persistAppearanceNow(nextAppearance);
      }, 400);
    },
    [persistAppearanceNow]
  );

  const flushSave = useCallback(async () => {
    if (debounceSaveTimerRef.current) {
      clearTimeout(debounceSaveTimerRef.current);
      debounceSaveTimerRef.current = null;
      await persistAppearanceNow(draftRef.current);
    }
  }, [persistAppearanceNow]);

  const retrySave = useCallback(async () => {
    await persistAppearanceNow(draftRef.current);
  }, [persistAppearanceNow]);

  // Perform undo
  const undo = useCallback(async () => {
    const prevStack = [...undoStack];
    if (prevStack.length === 0) return;
    const target = prevStack.pop()!;
    const currentSnapshot = cloneAppearance(draftRef.current);
    setUndoStack(prevStack);
    setRedoStack((r) => [currentSnapshot, ...r].slice(0, 20));
    setDraft(target);
    dismissSnackbar();
    trackEvent('undo_used', { pathname: location.pathname });
    await persistAppearanceNow(target);
  }, [undoStack, dismissSnackbar, persistAppearanceNow, trackEvent, location.pathname]);

  const redo = useCallback(async () => {
    if (redoStack.length === 0) return;
    const [target, ...rest] = redoStack;
    const currentSnapshot = cloneAppearance(draftRef.current);
    setRedoStack(rest);
    setUndoStack((u) => [...u, currentSnapshot].slice(-20));
    setDraft(target);
    dismissSnackbar();
    await persistAppearanceNow(target);
  }, [redoStack, dismissSnackbar, persistAppearanceNow]);

  const showAppliedSnackbar = useCallback(
    (message = 'Applied') => {
      presentSnackbar({
        message,
        actionLabel: 'Undo',
        onAction: () => void undo(),
      });
    },
    [presentSnackbar, undo]
  );

  const applyPatch = useCallback(
    (
      nextOrUpdater: Partial<Appearance> | ((prev: Appearance) => Appearance),
      opts?: {
        coalesce?: boolean;
        snackbarMessage?: string;
        showUndo?: boolean;
        checkBgToneShift?: boolean;
      }
    ) => {
      const prev = cloneAppearance(draftRef.current);
      const rawNext: Appearance =
        typeof nextOrUpdater === 'function'
          ? nextOrUpdater(prev)
          : {
              ...prev,
              ...nextOrUpdater,
            };

      if (areAppearancesEqual(prev, rawNext)) return;

      const now = Date.now();
      const shouldCoalesce = Boolean(opts?.coalesce) && now - lastUndoPushAtRef.current < 2000;
      if (!shouldCoalesce || undoStack.length === 0) {
        setUndoStack((u) => [...u, prev].slice(-20));
      }
      lastUndoPushAtRef.current = now;
      setRedoStack([]);

      let finalNext = cloneAppearance(rawNext);

      // Section 9.2 Smart follow-up when background changes significantly (>0.12 deltaE or tone flip)
      if (opts?.checkBgToneShift) {
        const oldBg = analyzeBackground(prev.background);
        const newBg = analyzeBackground(finalNext.background);
        const shifted =
          oldBg.tone !== newBg.tone || deltaE(oldBg.meanHex, newBg.meanHex) > 0.12;

        if (shifted) {
          const vibeObj = findCatalogVibe(finalNext.vibeId) || findCatalogVibe('porcelain')!;
          const topButtonIdeas = suggestButtons({
            bgProfile: newBg,
            bg: finalNext.background,
            vibe: vibeObj,
            current: finalNext.buttons,
            locks: finalNext.locks,
            seed: buildSuggestionSeed({
              pageId: session.username || 'owner',
              bgSignature: newBg.signature,
              vibeId: vibeObj.id,
              refreshCount: 0,
            }),
            refreshCount: 0,
          });
          const best = topButtonIdeas[0];
          if (best) {
            if (finalNext.autoMatchButtons) {
              finalNext = {
                ...finalNext,
                buttons: {
                  ...finalNext.buttons,
                  fill: best.fill,
                  text: best.text,
                  border: best.border,
                  borderWidth: best.borderWidth,
                  ...(best.surface ? { surface: best.surface } : {}),
                },
              };
              trackEvent('auto_match_prompt', { action: 'auto_applied' });
            } else {
              setTimeout(() => {
                presentSnackbar(
                  {
                    message: 'Background changed. Update buttons to match?',
                    actionLabel: 'Update',
                    onAction: () => {
                      trackEvent('auto_match_prompt', { action: 'accepted' });
                      applyPatch(
                        (curr) => ({
                          ...curr,
                          buttons: {
                            ...curr.buttons,
                            fill: best.fill,
                            text: best.text,
                            border: best.border,
                            borderWidth: best.borderWidth,
                            ...(best.surface ? { surface: best.surface } : {}),
                          },
                        }),
                        { snackbarMessage: 'Buttons updated', showUndo: true }
                      );
                    },
                    secondaryLabel: 'Keep',
                    onSecondary: () => {
                      trackEvent('auto_match_prompt', { action: 'kept' });
                      dismissSnackbar();
                    },
                  },
                  7500
                );
              }, 80);
            }
          }
        }
      }

      setDraft(finalNext);
      scheduleAutosave(finalNext);

      if (opts?.showUndo !== false && !opts?.checkBgToneShift) {
        presentSnackbar({
          message: opts?.snackbarMessage || 'Applied',
          actionLabel: 'Undo',
          onAction: () => void undo(),
        });
      }
    },
    [
      undoStack.length,
      session.username,
      scheduleAutosave,
      presentSnackbar,
      dismissSnackbar,
      undo,
      trackEvent,
    ]
  );

  const applyVibeChoice = useCallback(
    (vibeId: string, scope: 'everything' | 'colors-bg' | 'fonts-layout', keepLocks: boolean) => {
      trackEvent('vibe_applied', { vibe: vibeId, scope });
      applyPatch(
        (prev) => applyVibeWithScope(prev, vibeId, scope, keepLocks),
        { snackbarMessage: 'Vibe applied', showUndo: true }
      );
    },
    [applyPatch, trackEvent]
  );

  const toggleLock = useCallback(
    (lock: AppearanceLock) => {
      const nextLocked = !draftRef.current.locks.includes(lock);
      trackEvent('lock_toggled', { field: lock, locked: nextLocked });
      applyPatch(
        (prev) => {
          const exists = prev.locks.includes(lock);
          return {
            ...prev,
            locks: exists ? prev.locks.filter((l) => l !== lock) : [...prev.locks, lock],
          };
        },
        { showUndo: false }
      );
    },
    [applyPatch, trackEvent]
  );

  const toggleAutoMatchButtons = useCallback(() => {
    applyPatch(
      (prev) => ({
        ...prev,
        autoMatchButtons: !prev.autoMatchButtons,
      }),
      {
        snackbarMessage: !draftRef.current.autoMatchButtons
          ? 'Auto-match buttons on'
          : 'Auto-match buttons off',
        showUndo: false,
      }
    );
  }, [applyPatch]);

  const setAdvancedExpanded = useCallback(
    (val: boolean) => {
      setAdvancedExpandedState(val);
      try {
        localStorage.setItem(`iveo_appearance_adv_${session.username || 'owner'}`, val ? '1' : '0');
      } catch {}
    },
    [session.username]
  );

  const resetSection = useCallback(
    (section: AppearanceSectionKey) => {
      const activeVibe = findCatalogVibe(draftRef.current.vibeId) || findCatalogVibe('porcelain')!;
      const vibeDefaults = vibeToAppearanceDefaults(
        activeVibe,
        draftRef.current.locks,
        draftRef.current.autoMatchButtons ?? true
      );

      applyPatch(
        (prev) => {
          if (section === 'vibe') {
            return vibeToAppearanceDefaults(findCatalogVibe('porcelain')!, [], prev.autoMatchButtons ?? true);
          }
          if (section === 'background') {
            return { ...prev, background: vibeDefaults.background, migratedFrom: undefined };
          }
          if (section === 'typography') {
            return { ...prev, typography: vibeDefaults.typography };
          }
          if (section === 'buttons') {
            return { ...prev, buttons: vibeDefaults.buttons };
          }
          return { ...prev, layout: vibeDefaults.layout };
        },
        { snackbarMessage: 'Section reset', showUndo: true }
      );
    },
    [applyPatch]
  );

  const resetEverything = useCallback(() => {
    applyPatch(
      () => cloneAppearance(SYSTEM_DEFAULT_APPEARANCE),
      { snackbarMessage: 'Reset to default', showUndo: true }
    );
  }, [applyPatch]);

  const surpriseMe = useCallback(() => {
    const allowedVibes = session.isPro
      ? CATALOG_VIBES
      : CATALOG_VIBES.filter((v) => v.tier === 'free');
    const candidates = allowedVibes.filter((v) => v.id !== draftRef.current.vibeId);
    const pool = candidates.length > 0 ? candidates : allowedVibes;
    const picked = pool[Math.floor(Math.random() * pool.length)] || CATALOG_VIBES[0];

    applyPatch(
      (prev) => {
        const base = vibeToAppearanceDefaults(picked, prev.locks, prev.autoMatchButtons ?? true);
        const targetBg: Background = prev.locks.includes('background')
          ? prev.background
          : base.background;
        const bgProf = analyzeBackground(targetBg, { pageTextHex: picked.page.text });
        const seed = buildSuggestionSeed({
          pageId: session.username || 'owner',
          bgSignature: bgProf.signature,
          vibeId: picked.id,
          refreshCount: Math.floor(Math.random() * 9999),
        });

        const btnSet = suggestButtons({
          bgProfile: bgProf,
          bg: targetBg,
          vibe: picked,
          current: base.buttons,
          locks: prev.locks,
          seed,
          refreshCount: 1,
        })[0];

        const fontCombo = suggestFonts({
          bgProfile: bgProf,
          vibe: picked,
          current: {
            name: base.typography.name,
            bio: base.typography.bio,
            button: base.typography.button,
          },
          currentSurface: btnSet?.surface || base.buttons.surface,
          locks: prev.locks,
          seed,
          isPro: session.isPro,
        })[0];

        const layoutIdea = suggestLayouts({
          bgProfile: bgProf,
          bg: targetBg,
          vibe: picked,
          buttons: base.buttons,
          currentLayout: base.layout,
          locks: prev.locks,
          seed,
        })[0];

        return {
          ...base,
          background: targetBg,
          buttons: {
            ...base.buttons,
            fill: prev.locks.includes('btn.fill') ? prev.buttons.fill : btnSet?.fill || base.buttons.fill,
            text: prev.locks.includes('btn.text') ? prev.buttons.text : btnSet?.text || base.buttons.text,
            border: prev.locks.includes('btn.border') ? prev.buttons.border : btnSet?.border || base.buttons.border,
            borderWidth: btnSet?.borderWidth ?? base.buttons.borderWidth,
            surface: btnSet?.surface || layoutIdea?.surface || base.buttons.surface,
            size: layoutIdea?.buttonSize || base.buttons.size,
            motion: layoutIdea?.motion || base.buttons.motion,
          },
          typography: {
            name: prev.locks.includes('font.name')
              ? prev.typography.name
              : fontCombo
                ? { ...base.typography.name, ...fontCombo.nameFont, source: 'suggestion' }
                : base.typography.name,
            bio: prev.locks.includes('font.bio')
              ? prev.typography.bio
              : fontCombo
                ? { ...base.typography.bio, ...fontCombo.bioFont, source: 'suggestion' }
                : base.typography.bio,
            button: prev.locks.includes('font.button')
              ? prev.typography.button
              : fontCombo
                ? { ...base.typography.button, ...fontCombo.buttonFont, source: 'suggestion' }
                : base.typography.button,
          },
          layout: prev.locks.includes('layout')
            ? prev.layout
            : layoutIdea
              ? {
                  ...base.layout,
                  header: layoutIdea.header,
                  avatar: layoutIdea.avatar,
                  linkLayout: layoutIdea.linkLayout,
                  spacing: layoutIdea.spacing,
                  width: layoutIdea.width,
                  entrance: layoutIdea.entrance,
                }
              : base.layout,
        };
      },
      { snackbarMessage: "Here's a new look", showUndo: true }
    );
  }, [session.isPro, session.username, applyPatch]);

  const setCardLook = useCallback(
    async (look: CardLookStyle) => {
      try {
        await session.updatePreferences({
          layoutSettings: {
            ...(session.layoutSettings || {
              avatarShape: 'circle',
              headerAlign: 'center',
              buttonStyle: 'solid',
              linkSpacing: 'normal',
              pageWidth: 'standard',
            }),
            cardLook: look,
          },
        });
        showToast('Card look updated');
      } catch {
        showToast("Couldn't update card look");
      }
    },
    [session, showToast]
  );

  const hideFooterMark = Boolean(session.isPro && (session.hideIveoFooter || session.hideIvioFooter));

  const toggleHideFooterMark = useCallback(async () => {
    if (!session.isPro) {
      openUpgrade();
      return;
    }
    const next = !hideFooterMark;
    try {
      await session.updatePreferences({
        hideIveoFooter: next,
        hideIvioFooter: next,
      });
      showToast(next ? 'Footer branding hidden' : 'Footer branding shown');
    } catch {
      showToast("Couldn't update branding setting");
    }
  }, [session, hideFooterMark, openUpgrade, showToast]);

  // Themes API (plus demo/local fallback)
  const persistLocalThemes = useCallback(
    (list: ThemePreset[]) => {
      try {
        localStorage.setItem(`iveo_themes_${session.username || 'owner'}`, JSON.stringify(list));
      } catch {}
    },
    [session.username]
  );

  const loadThemes = useCallback(async () => {
    if (isDemo || !session.userId || !session.username) return;
    setThemesLoading(true);
    try {
      const res = await fetch(`/api/appearance/themes?username=${encodeURIComponent(session.username)}`, {
        headers: {
          'x-user-id': session.userId,
          'x-iveo-username': session.username,
          ...(session.primaryEmail ? { 'x-user-email': session.primaryEmail } : {}),
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.themes)) {
          setThemes(json.themes);
          persistLocalThemes(json.themes);
        }
      }
    } catch {} finally {
      setThemesLoading(false);
    }
  }, [isDemo, session.userId, session.username, session.primaryEmail, persistLocalThemes]);

  const saveTheme = useCallback(
    async (name: string): Promise<{ ok: boolean; error?: string }> => {
      const cleanName = name.trim();
      if (!cleanName) return { ok: false, error: 'Enter a theme name.' };
      const limit = session.isPro ? 10 : 1;
      if (themes.length >= limit) {
        if (!session.isPro) openUpgrade();
        return { ok: false, error: session.isPro ? 'Maximum 10 themes reached.' : 'Free plan supports 1 saved theme.' };
      }

      if (isDemo || !session.userId || !session.username) {
        const created: ThemePreset = {
          id: `theme-${Date.now()}`,
          name: cleanName,
          data: cloneAppearance(draftRef.current),
          createdAt: new Date().toISOString(),
        };
        const nextList = [created, ...themes];
        setThemes(nextList);
        persistLocalThemes(nextList);
        return { ok: true };
      }

      try {
        const res = await fetch('/api/appearance/themes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': session.userId,
            'x-iveo-username': session.username,
            ...(session.primaryEmail ? { 'x-user-email': session.primaryEmail } : {}),
          },
          body: JSON.stringify({ username: session.username, name: cleanName, appearance: draftRef.current }),
        });
        if (res.status === 402) {
          openUpgrade();
          return { ok: false, error: 'Upgrade to Pro for up to 10 saved themes.' };
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: json.error || 'Could not save theme.' };
        const nextList = Array.isArray(json.themes) ? json.themes : [json.theme, ...themes];
        setThemes(nextList);
        persistLocalThemes(nextList);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error.' };
      }
    },
    [session.isPro, session.userId, session.username, session.primaryEmail, themes, isDemo, openUpgrade, persistLocalThemes]
  );

  const applyTheme = useCallback(
    (theme: ThemePreset) => {
      applyPatch(() => cloneAppearance(theme.data), {
        snackbarMessage: `Applied "${theme.name}"`,
        showUndo: true,
      });
    },
    [applyPatch]
  );

  const renameTheme = useCallback(
    async (id: string, name: string): Promise<{ ok: boolean; error?: string }> => {
      const cleanName = name.trim();
      if (!cleanName) return { ok: false, error: 'Name required.' };
      const nextList = themes.map((t) => (t.id === id ? { ...t, name: cleanName } : t));
      setThemes(nextList);
      persistLocalThemes(nextList);

      if (!isDemo && session.userId && session.username) {
        await fetch(`/api/appearance/themes/${encodeURIComponent(id)}?username=${encodeURIComponent(session.username)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': session.userId,
            'x-iveo-username': session.username,
            ...(session.primaryEmail ? { 'x-user-email': session.primaryEmail } : {}),
          },
          body: JSON.stringify({ name: cleanName }),
        }).catch(() => {});
      }
      return { ok: true };
    },
    [themes, isDemo, session.userId, session.username, session.primaryEmail, persistLocalThemes]
  );

  const deleteTheme = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      const nextList = themes.filter((t) => t.id !== id);
      setThemes(nextList);
      persistLocalThemes(nextList);

      if (!isDemo && session.userId && session.username) {
        await fetch(`/api/appearance/themes/${encodeURIComponent(id)}?username=${encodeURIComponent(session.username)}`, {
          method: 'DELETE',
          headers: {
            'x-user-id': session.userId,
            'x-iveo-username': session.username,
            ...(session.primaryEmail ? { 'x-user-email': session.primaryEmail } : {}),
          },
        }).catch(() => {});
      }
      return { ok: true };
    },
    [themes, isDemo, session.userId, session.username, persistLocalThemes]
  );

  const saveScrollPos = useCallback((pathname: string, scrollY: number) => {
    scrollPositionsRef.current.set(pathname, scrollY);
  }, []);

  const getScrollPos = useCallback((pathname: string) => {
    return scrollPositionsRef.current.get(pathname) || 0;
  }, []);

  const resolved = useMemo(
    () => resolveTokens(draft, { isPro: session.isPro }),
    [draft, session.isPro]
  );

  const homeSummary = useMemo(
    () => buildAppearanceHomeSummary(draft, resolved),
    [draft, resolved]
  );

  const hasCustomOverrides = useMemo(() => {
    if (draft.migratedFrom) return true;
    const baseVibe = findCatalogVibe(draft.vibeId);
    if (!baseVibe) return true;
    const defaults = vibeToAppearanceDefaults(baseVibe, [], draft.autoMatchButtons ?? true);
    return (
      JSON.stringify(draft.background) !== JSON.stringify(defaults.background) ||
      JSON.stringify(draft.buttons) !== JSON.stringify(defaults.buttons) ||
      JSON.stringify(draft.typography) !== JSON.stringify(defaults.typography) ||
      JSON.stringify(draft.layout) !== JSON.stringify(defaults.layout)
    );
  }, [draft]);

  const value: AppearanceContextValue = {
    draft,
    resolved,
    homeSummary,
    isPro: session.isPro,
    isDemo,
    saveStatus,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    themes,
    themesLoading,
    snackbar,
    advancedExpanded,
    cardLook: session.layoutSettings?.cardLook || 'match_page',
    hideFooterMark,
    applyPatch,
    applyVibeChoice,
    toggleLock,
    toggleAutoMatchButtons,
    setAdvancedExpanded,
    setCardLook,
    toggleHideFooterMark,
    undo,
    redo,
    resetSection,
    resetEverything,
    surpriseMe,
    retrySave,
    flushSave,
    dismissSnackbar,
    showAppliedSnackbar,
    loadThemes,
    saveTheme,
    applyTheme,
    renameTheme,
    deleteTheme,
    saveScrollPos,
    getScrollPos,
    trackEvent,
    hasCustomOverrides,
  };

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
};

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error('useAppearance must be used inside AppearanceProvider');
  }
  return ctx;
}
