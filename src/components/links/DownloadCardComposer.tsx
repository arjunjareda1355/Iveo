import React, { useState } from 'react';
import { FileDown } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DownloadConfig } from '../../data/types';
import { formatExternalUrl } from '../../lib/urls';

interface DownloadCardComposerProps {
  onAdd: (data: {
    title: string;
    url: string;
    download: DownloadConfig;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialValues?: {
    title?: string;
    url?: string;
    download?: DownloadConfig | null;
  };
  isEditing?: boolean;
}

export const DownloadCardComposer: React.FC<DownloadCardComposerProps> = ({
  onAdd,
  onCancel,
  isSubmitting = false,
  initialValues,
  isEditing = false,
}) => {
  const [title, setTitle] = useState(initialValues?.title || 'Media Kit & Press Deck');
  const [url, setUrl] = useState(initialValues?.url || '');
  const [fileFormat, setFileFormat] = useState(initialValues?.download?.fileFormat || 'PDF');
  const [fileSize, setFileSize] = useState(initialValues?.download?.fileSize || '4.2 MB');
  const [description, setDescription] = useState(
    initialValues?.download?.description || 'Rates, audience stats & brand assets'
  );
  const [buttonLabel, setButtonLabel] = useState(
    initialValues?.download?.buttonLabel || 'Download'
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Resource title is required.');
      return;
    }
    if (!url.trim()) {
      setError('Direct file or cloud link (Drive, Dropbox, Notion, PDF URL) is required.');
      return;
    }

    try {
      await onAdd({
        title: title.trim(),
        url: formatExternalUrl(url),
        download: {
          fileFormat: fileFormat.trim().toUpperCase() || 'PDF',
          fileSize: fileSize.trim() || null,
          description: description.trim() || null,
          buttonLabel: buttonLabel.trim() || 'Download',
        },
      });
    } catch (err: any) {
      setError(err?.message || "Couldn't save download card.");
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-ink/20 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2.5 pb-2.5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 text-violet-700 flex items-center justify-center shrink-0">
          <FileDown size={18} strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-ink leading-tight">
            {isEditing ? 'Edit File / Media Kit Card' : 'Add Download / Media Kit Card'}
          </h3>
          <p className="text-[12px] text-muted">
            Share a downloadable PDF, portfolio, resume, preset pack, or press kit with file badge
          </p>
        </div>
      </div>

      {error && (
        <div className="text-[12px] text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dl-title" className="text-[13px] font-medium text-ink">
              File / Resource Title
            </label>
            <input
              id="dl-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 2026 Media Kit & Rates"
              maxLength={60}
              autoFocus
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="dl-url" className="text-[13px] font-medium text-ink">
              File Download URL
            </label>
            <input
              id="dl-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="drive.google.com/... or https://.../kit.pdf"
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dl-fmt" className="text-[13px] font-medium text-ink">
              Format
            </label>
            <input
              id="dl-fmt"
              type="text"
              value={fileFormat}
              onChange={(e) => setFileFormat(e.target.value)}
              placeholder="PDF / ZIP"
              maxLength={10}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] uppercase text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="dl-size" className="text-[13px] font-medium text-ink">
              File Size
            </label>
            <input
              id="dl-size"
              type="text"
              value={fileSize}
              onChange={(e) => setFileSize(e.target.value)}
              placeholder="4.2 MB"
              maxLength={16}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="dl-cta" className="text-[13px] font-medium text-ink">
              Button Text
            </label>
            <input
              id="dl-cta"
              type="text"
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              placeholder="Download"
              maxLength={20}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="dl-desc" className="text-[13px] font-medium text-ink">
            Description (Optional)
          </label>
          <input
            id="dl-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's inside this download"
            maxLength={80}
            className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        <div className="p-3.5 rounded-xl border border-violet-500/20 bg-violet-500/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-violet-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
              {(fileFormat || 'PDF').slice(0, 4).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-ink truncate">
                {title || 'Download Resource'}
              </div>
              <div className="text-[11px] text-muted truncate">
                {[fileSize, description].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-violet-600 text-white text-[11px] font-semibold shrink-0 inline-flex items-center gap-1">
            <FileDown size={11} />
            <span>{buttonLabel || 'Download'}</span>
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Download Card'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
