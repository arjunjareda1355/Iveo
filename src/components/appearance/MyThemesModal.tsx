import React, { useEffect, useState } from 'react';
import { Bookmark, Check, Edit3, Plus, Trash2, X } from 'lucide-react';
import type { ThemePreset } from '../../lib/appearance/types';
import { THEME_LIMITS } from '../../lib/appearance/types';
import { useAppearance } from './AppearanceContext';
import { ProBadge } from '../plan/ProBadge';

interface MyThemesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MyThemesModal: React.FC<MyThemesModalProps> = ({ isOpen, onClose }) => {
  const {
    themes,
    themesLoading,
    isPro,
    loadThemes,
    saveTheme,
    applyTheme,
    renameTheme,
    deleteTheme,
    resolved,
  } = useAppearance();

  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError(null);
      void loadThemes();
    }
  }, [isOpen, loadThemes]);

  if (!isOpen) return null;

  const limit = isPro ? THEME_LIMITS.pro : THEME_LIMITS.free;
  const atLimit = themes.length >= limit;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await saveTheme(newName || `${resolved.vibeName} look`);
    setSaving(false);
    if (!res.ok) {
      setError(res.error || 'Could not save theme.');
    } else {
      setNewName('');
    }
  };

  const handleApply = async (t: ThemePreset) => {
    setError(null);
    setApplyingId(t.id);
    const res = await applyTheme(t);
    setApplyingId(null);
    if (!res.ok) {
      setError(res.error || 'Could not apply theme.');
      return;
    }
    onClose();
  };

  const handleRenameSubmit = async (id: string) => {
    await renameTheme(id, editName);
    setEditingId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="My themes"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-md bg-surface rounded-t-[24px] sm:rounded-[20px] border border-border shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark size={18} strokeWidth={1.75} className="text-ink" />
            <h2 className="text-[16px] font-semibold text-ink">My themes</h2>
            <span className="text-[12px] text-muted tabular-nums">
              ({themes.length}/{limit})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close themes"
            className="w-10 h-10 inline-flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-surface-2 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-4">
          <form onSubmit={handleSave} className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Save current (${resolved.vibeName})`}
              className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-border bg-bg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
            <button
              type="submit"
              disabled={saving || atLimit}
              className="h-11 px-4 rounded-xl bg-ink text-white text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-ink-2 disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Plus size={15} />
              <span>Save</span>
            </button>
          </form>

          {atLimit && !isPro && (
            <div className="flex items-center justify-between gap-2 text-[12px] text-muted bg-surface-2 px-3 py-2 rounded-xl border border-border">
              <span>Free accounts can store 1 saved theme.</span>
              <ProBadge locked />
            </div>
          )}

          {error && <p className="text-[12px] text-red-600 font-medium">{error}</p>}

          {themesLoading ? (
            <div className="flex flex-col gap-2">
              <div className="h-16 rounded-xl bg-surface-2 animate-pulse" />
              <div className="h-16 rounded-xl bg-surface-2 animate-pulse" />
            </div>
          ) : themes.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted">
              Save your current vibe, fonts and colours here to switch anytime.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {themes.map((t) => {
                const bgFill =
                  t.data.background.type === 'solid'
                    ? t.data.background.color
                    : '#E5E7EB';
                const btnFill = String(t.data.buttons.fill || '#121212');
                const btnText = String(t.data.buttons.text || '#FFFFFF');

                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-surface hover:border-border-strong transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-10 h-10 rounded-xl border border-border shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: bgFill }}
                      >
                        <span
                          className="w-6 h-3 rounded-full"
                          style={{ backgroundColor: btnFill, border: `1px solid ${btnText}33` }}
                        />
                      </div>

                      {editingId === t.id ? (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 min-w-0 h-8 px-2 rounded-lg border border-border text-[13px]"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => void handleRenameSubmit(t.id)}
                            aria-label="Confirm rename"
                            className="w-8 h-8 rounded-lg bg-ink text-white inline-flex items-center justify-center cursor-pointer"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-ink truncate">{t.name}</p>
                          <p className="text-[12px] text-muted truncate">
                            {t.data.typography.name.family}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={applyingId === t.id}
                        onClick={() => void handleApply(t)}
                        className="h-9 px-3 rounded-xl bg-ink text-white text-[12px] font-semibold cursor-pointer hover:bg-ink-2 disabled:opacity-50"
                      >
                        {applyingId === t.id ? 'Applying...' : 'Apply'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(t.id);
                          setEditName(t.name);
                        }}
                        aria-label={`Rename ${t.name}`}
                        className="w-9 h-9 inline-flex items-center justify-center rounded-xl text-muted hover:text-ink hover:bg-surface-2 cursor-pointer"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTheme(t.id)}
                        aria-label={`Delete ${t.name}`}
                        className="w-9 h-9 inline-flex items-center justify-center rounded-xl text-muted hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
