import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ExternalLink,
  ChevronDown,
  GripVertical,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { useIveoSession } from '../../auth/useIvioSession';
import {
  SUPPORTED_SOCIAL_PLATFORMS,
  SocialIcon,
} from '../phone/SocialIcons';
import {
  formatExternalUrl,
  validateAndFormatSocialInput,
} from '../../lib/urls';
import { useToast } from '../ui/Toast';

interface SocialLinksCardProps {
  externalAddTrigger?: number;
}

const PLACEMENT_OPTIONS: readonly { value: 'top' | 'bottom' | 'both'; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'both', label: 'Both' },
];

function canonicalizeSocialUrlForSave(platform: string, rawUrl: string): string {
  const res = validateAndFormatSocialInput(platform, rawUrl);
  if (!res.ok) return rawUrl.trim();
  const formatted = res.url;
  try {
    const u = new URL(formatted);
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return formatted;
  }
}

export const SocialLinksCard: React.FC<SocialLinksCardProps> = ({
  externalAddTrigger = 0,
}) => {
  const session = useIveoSession();
  const { showToast } = useToast();
  const { socials, updateSocials, socialsPosition = 'top', updatePreferences } = session;

  const activeEntries = Object.entries(socials || {}).filter(
    ([, url]) => typeof url === 'string' && url.trim().length > 0
  );

  const [isExpanded, setIsExpanded] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('instagram');
  const [urlInput, setUrlInput] = useState('');
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [editUrlInput, setEditUrlInput] = useState('');
  const [confirmDeletePlatform, setConfirmDeletePlatform] = useState<string | null>(null);
  const [draggedPlatform, setDraggedPlatform] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedPlatformConfig =
    SUPPORTED_SOCIAL_PLATFORMS.find((p) => p.id === selectedPlatform) ||
    SUPPORTED_SOCIAL_PLATFORMS[0];

  const handleOpenAdd = () => {
    const unusedPlatform =
      SUPPORTED_SOCIAL_PLATFORMS.find((p) => !socials[p.id])?.id || 'instagram';
    setSelectedPlatform(unusedPlatform);
    setUrlInput('');
    setErrorMessage(null);
    setEditingPlatform(null);
    setConfirmDeletePlatform(null);
    setIsExpanded(true);
    setIsAdding(true);
  };

  useEffect(() => {
    if (externalAddTrigger > 0) {
      handleOpenAdd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalAddTrigger]);

  const handleCancelAdd = () => {
    setIsAdding(false);
    setUrlInput('');
    setErrorMessage(null);
  };

  const handleStartEdit = (platform: string, currentUrl: string) => {
    setEditingPlatform(platform);
    setEditUrlInput(currentUrl);
    setErrorMessage(null);
    setConfirmDeletePlatform(null);
    setIsAdding(false);
  };

  const handleCancelEdit = () => {
    setEditingPlatform(null);
    setEditUrlInput('');
    setErrorMessage(null);
  };

  const handleSaveSocial = async (platform: string, rawUrl: string) => {
    const clean = rawUrl.trim();
    if (!clean) {
      setErrorMessage('Please enter a valid link or handle.');
      return;
    }

    const validation = validateAndFormatSocialInput(platform, clean);
    if (!validation.ok) {
      setErrorMessage(validation.error);
      return;
    }

    const finalUrl = canonicalizeSocialUrlForSave(platform, validation.url);

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updated = {
        ...socials,
        [platform]: finalUrl,
      };
      await updateSocials(updated);
      setIsAdding(false);
      setUrlInput('');
      setEditingPlatform(null);
      setEditUrlInput('');
      showToast('Social icon saved');
    } catch {
      setErrorMessage('Could not save social link. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSocial = async (platform: string) => {
    setIsSaving(true);
    try {
      const updated = { ...socials };
      delete updated[platform];
      await updateSocials(updated);
      setConfirmDeletePlatform(null);
      showToast('Social icon removed');
    } catch {
      setErrorMessage('Could not remove social link.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDropReorder = async (targetPlatform: string) => {
    if (!draggedPlatform || draggedPlatform === targetPlatform) {
      setDraggedPlatform(null);
      return;
    }
    const keys = activeEntries.map(([k]) => k);
    const fromIdx = keys.indexOf(draggedPlatform);
    const toIdx = keys.indexOf(targetPlatform);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedPlatform(null);
      return;
    }
    const nextOrder = [...keys];
    const [moved] = nextOrder.splice(fromIdx, 1);
    nextOrder.splice(toIdx, 0, moved);

    const reorderedMap: Record<string, string> = {};
    for (const key of nextOrder) {
      if (socials[key]) reorderedMap[key] = socials[key];
    }
    setDraggedPlatform(null);
    await updateSocials(reorderedMap).catch(() => {
      showToast("Couldn't reorder social icons.");
    });
  };

  return (
    <Card className="flex flex-col gap-4" id="social-icons-card">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="flex items-center gap-2 text-left min-h-[44px] cursor-pointer group"
        >
          <ChevronDown
            size={18}
            strokeWidth={1.75}
            className={`text-muted group-hover:text-ink transition-transform shrink-0 ${
              isExpanded ? 'rotate-0' : '-rotate-90'
            }`}
          />
          <h3 className="text-[16px] font-semibold text-ink leading-tight">
            Social icons
          </h3>
          {activeEntries.length > 0 && (
            <span className="text-[12px] text-muted font-normal tabular-nums">
              ({activeEntries.length})
            </span>
          )}
        </button>

        {!isAdding && !editingPlatform && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenAdd}
            className="min-h-[40px] shrink-0"
          >
            <Plus size={15} />
            <span>Add</span>
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-4">
          {/* Icon placement using high-contrast SegmentedControl */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            <div className="min-w-0">
              <span className="text-[13px] font-medium text-ink block">
                Icon placement
              </span>
              <span className="text-[12px] text-muted block">
                Where social icons appear on your page
              </span>
            </div>
            <div className="w-full sm:w-[220px] shrink-0">
              <SegmentedControl<'top' | 'bottom' | 'both'>
                options={PLACEMENT_OPTIONS}
                value={socialsPosition}
                onChange={(val) => updatePreferences({ socialsPosition: val })}
                ariaLabel="Social icon placement"
              />
            </div>
          </div>

          {/* Add Social Account Form */}
          {isAdding && (
            <div className="p-3.5 rounded-[12px] bg-surface-2 border border-border flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-ink">
                  Add social account
                </span>
                <button
                  type="button"
                  onClick={handleCancelAdd}
                  className="w-9 h-9 inline-flex items-center justify-center rounded-full text-muted hover:text-ink cursor-pointer"
                  aria-label="Cancel"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label htmlFor="platform-select" className="text-[12px] font-medium text-muted">
                    Platform
                  </label>
                  <select
                    id="platform-select"
                    value={selectedPlatform}
                    onChange={(e) => {
                      setSelectedPlatform(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className="h-11 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink cursor-pointer"
                  >
                    {SUPPORTED_SOCIAL_PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label htmlFor="platform-url" className="text-[12px] font-medium text-muted">
                    Profile link or handle
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-muted">
                      <SocialIcon platform={selectedPlatform} size={16} />
                    </span>
                    <input
                      id="platform-url"
                      type="text"
                      value={urlInput}
                      onChange={(e) => {
                        setUrlInput(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder={selectedPlatformConfig.placeholder}
                      className="w-full h-11 pl-9 pr-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-ink"
                      autoFocus
                    />
                  </div>
                </div>
              </div>

              {errorMessage && (
                <p className="text-[12px] text-[color:var(--error,#B3261E)] font-medium" role="alert">
                  {errorMessage}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCancelAdd}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleSaveSocial(selectedPlatform, urlInput)}
                  disabled={isSaving || !urlInput.trim()}
                >
                  {isSaving ? 'Adding...' : 'Add icon'}
                </Button>
              </div>
            </div>
          )}

          {/* Active Social Accounts List */}
          {activeEntries.length === 0 && !isAdding ? (
            <div className="py-5 px-4 rounded-[12px] border border-dashed border-border text-center flex flex-col items-center justify-center gap-2">
              <p className="text-[13px] text-muted">
                No social icons added yet.
              </p>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="text-[13px] text-ink font-semibold underline underline-offset-2 hover:opacity-80 cursor-pointer min-h-[36px]"
              >
                Add Instagram, YouTube, X, or Email
              </button>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-divider border border-border rounded-[12px] overflow-hidden bg-surface">
              {activeEntries.map(([platform, url]) => {
                const config =
                  SUPPORTED_SOCIAL_PLATFORMS.find((p) => p.id === platform) || {
                    id: platform,
                    name: platform.charAt(0).toUpperCase() + platform.slice(1),
                    placeholder: '',
                  };

                const isEditingThis = editingPlatform === platform;
                const isConfirmingDelete = confirmDeletePlatform === platform;

                if (isEditingThis) {
                  return (
                    <div key={platform} className="p-3.5 bg-surface-2 flex flex-col gap-2.5">
                      <div className="flex items-center gap-2">
                        <SocialIcon platform={platform} size={16} />
                        <span className="text-[13px] font-semibold text-ink">{config.name}</span>
                      </div>
                      <input
                        type="text"
                        value={editUrlInput}
                        onChange={(e) => {
                          setEditUrlInput(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        className="w-full h-11 px-3 bg-surface border border-border rounded-[10px] text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                        autoFocus
                      />
                      {errorMessage && (
                        <p className="text-[12px] text-[color:var(--error,#B3261E)]">{errorMessage}</p>
                      )}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleSaveSocial(platform, editUrlInput)}
                          disabled={isSaving || !editUrlInput.trim()}
                        >
                          <Check size={14} className="mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={platform}
                    draggable
                    onDragStart={() => setDraggedPlatform(platform)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropReorder(platform)}
                    onDragEnd={() => setDraggedPlatform(null)}
                    className={`min-h-[60px] px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                      draggedPlatform === platform ? 'opacity-50 bg-surface-2' : 'hover:bg-surface-2/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className="text-muted/60 cursor-grab active:cursor-grabbing shrink-0 touch-none"
                        title="Drag to reorder"
                        aria-hidden="true"
                      >
                        <GripVertical size={16} strokeWidth={1.5} />
                      </span>
                      <div className="w-9 h-9 rounded-[10px] bg-surface-2 border border-border flex items-center justify-center shrink-0 text-ink">
                        <SocialIcon platform={platform} size={18} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[14px] font-medium text-ink leading-snug">
                          {config.name}
                        </span>
                        <a
                          href={formatExternalUrl(url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-muted truncate hover:underline hover:text-ink inline-flex items-center gap-1"
                        >
                          <span className="truncate">{url.replace(/^https?:\/\//i, '')}</span>
                          <ExternalLink size={10} className="shrink-0 opacity-60" />
                        </a>
                      </div>
                    </div>

                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeletePlatform(null)}
                          disabled={isSaving}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteSocial(platform)}
                          disabled={isSaving}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(platform, url)}
                          aria-label={`Edit ${config.name}`}
                          className="w-10 h-10 inline-flex items-center justify-center text-muted hover:text-ink rounded-[10px] hover:bg-surface-2 transition-colors cursor-pointer"
                        >
                          <Edit2 size={16} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePlatform(platform)}
                          aria-label={`Remove ${config.name}`}
                          className="w-10 h-10 inline-flex items-center justify-center text-muted hover:text-[color:var(--error,#B3261E)] rounded-[10px] hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={16} strokeWidth={1.5} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
