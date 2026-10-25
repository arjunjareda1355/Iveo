import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, ExternalLink } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useIveoSession } from '../../auth/useIvioSession';
import {
  SUPPORTED_SOCIAL_PLATFORMS,
  SocialIcon,
} from '../phone/SocialIcons';
import { formatExternalUrl } from '../../lib/urls';

export const SocialLinksCard: React.FC = () => {
  const session = useIveoSession();
  const { socials, updateSocials } = session;

  const [isAdding, setIsAdding] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('instagram');
  const [urlInput, setUrlInput] = useState('');
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [editUrlInput, setEditUrlInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Active entries that have non-empty URLs
  const activeEntries = Object.entries(socials || {}).filter(
    ([_, url]) => typeof url === 'string' && url.trim().length > 0
  );

  const selectedPlatformConfig =
    SUPPORTED_SOCIAL_PLATFORMS.find((p) => p.id === selectedPlatform) ||
    SUPPORTED_SOCIAL_PLATFORMS[0];

  const handleOpenAdd = () => {
    // Pick the first platform not yet added, if any
    const unusedPlatform =
      SUPPORTED_SOCIAL_PLATFORMS.find((p) => !socials[p.id])?.id || 'instagram';
    setSelectedPlatform(unusedPlatform);
    setUrlInput('');
    setErrorMessage(null);
    setEditingPlatform(null);
    setIsAdding(true);
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setUrlInput('');
    setErrorMessage(null);
  };

  const handleStartEdit = (platform: string, currentUrl: string) => {
    setEditingPlatform(platform);
    setEditUrlInput(currentUrl);
    setErrorMessage(null);
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

    let finalUrl = clean;
    if (platform === 'mail' || platform === 'email') {
      if (!clean.startsWith('mailto:') && clean.includes('@')) {
        finalUrl = `mailto:${clean}`;
      }
    } else {
      finalUrl = formatExternalUrl(clean);
    }

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
    } catch {
      setErrorMessage('Could not remove social link.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[18px] font-semibold text-ink leading-tight">
            Social icons
          </h3>
          <p className="mt-1 text-[13px] text-muted max-w-[50ch]">
            Add icons linking to your social accounts. They appear neatly below your links and stay completely hidden if you haven't added any.
          </p>
        </div>

        {!isAdding && !editingPlatform && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenAdd}
            iconLeft={<Plus size={14} />}
          >
            Add social icon
          </Button>
        )}
      </div>

      {/* Form: Adding new social icon */}
      {isAdding && (
        <div className="p-4 rounded-[12px] bg-surface-2 border border-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-ink">Add social account</span>
            <button
              type="button"
              onClick={handleCancelAdd}
              className="text-muted hover:text-ink cursor-pointer"
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
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="h-10 px-3 bg-surface border border-border rounded-[8px] text-[14px] text-ink focus:outline-ink cursor-pointer"
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
                  className="w-full h-10 pl-9 pr-3 bg-surface border border-border rounded-[8px] text-[14px] text-ink focus:outline-ink"
                  autoFocus
                />
              </div>
            </div>
          </div>

          {errorMessage && (
            <p className="text-[12px] text-red-600 font-medium">{errorMessage}</p>
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
        <div className="py-6 px-4 rounded-[10px] border border-dashed border-border text-center flex flex-col items-center justify-center gap-2">
          <p className="text-[14px] text-muted">
            No social accounts added yet.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="text-[13px] text-ink font-semibold underline underline-offset-2 hover:opacity-80 cursor-pointer"
          >
            Add an Instagram, YouTube, X, or other profile
          </button>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/60 border border-border rounded-[10px] overflow-hidden bg-surface">
          {activeEntries.map(([platform, url]) => {
            const config =
              SUPPORTED_SOCIAL_PLATFORMS.find((p) => p.id === platform) || {
                id: platform,
                name: platform.charAt(0).toUpperCase() + platform.slice(1),
                placeholder: '',
              };

            const isEditingThis = editingPlatform === platform;

            if (isEditingThis) {
              return (
                <div key={platform} className="p-3 bg-surface-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <SocialIcon platform={platform} size={16} />
                    <span className="text-[13px] font-semibold text-ink">{config.name}</span>
                  </div>
                  <input
                    type="text"
                    value={editUrlInput}
                    onChange={(e) => setEditUrlInput(e.target.value)}
                    className="w-full h-9 px-3 bg-surface border border-border rounded-[6px] text-[13px] text-ink focus:outline-ink"
                    autoFocus
                  />
                  {errorMessage && (
                    <p className="text-[12px] text-red-600">{errorMessage}</p>
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
                className="h-12 px-3.5 flex items-center justify-between gap-3 hover:bg-surface-2/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-[8px] bg-surface-2 border border-border/80 flex items-center justify-center shrink-0 text-ink">
                    <SocialIcon platform={platform} size={16} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-semibold text-ink leading-none">
                      {config.name}
                    </span>
                    <a
                      href={formatExternalUrl(url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-muted truncate hover:underline hover:text-ink mt-0.5 inline-flex items-center gap-1"
                    >
                      <span className="truncate">{url}</span>
                      <ExternalLink size={10} className="shrink-0 opacity-60" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(platform, url)}
                    aria-label={`Edit ${config.name}`}
                    className="p-1.5 text-muted hover:text-ink rounded-[6px] hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSocial(platform)}
                    aria-label={`Remove ${config.name}`}
                    className="p-1.5 text-muted hover:text-red-600 rounded-[6px] hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
