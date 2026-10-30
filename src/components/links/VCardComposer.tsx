import React, { useState } from 'react';
import { UserCheck, Phone, Mail, Building, Briefcase, FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { VCardConfig } from '../../data/types';

interface VCardComposerProps {
  onSave: (config: VCardConfig, title?: string) => Promise<void>;
  onCancel: () => void;
  initialConfig?: VCardConfig | null;
  defaultFullName?: string;
  defaultEmail?: string;
}

export const VCardComposer: React.FC<VCardComposerProps> = ({
  onSave,
  onCancel,
  initialConfig,
  defaultFullName = '',
  defaultEmail = '',
}) => {
  const [fullName, setFullName] = useState(initialConfig?.fullName || defaultFullName);
  const [title, setTitle] = useState(initialConfig?.title || '');
  const [organization, setOrganization] = useState(initialConfig?.organization || '');
  const [phone, setPhone] = useState(initialConfig?.phone || '');
  const [email, setEmail] = useState(initialConfig?.email || defaultEmail);
  const [note, setNote] = useState(initialConfig?.note || '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave(
        {
          fullName: fullName.trim(),
          title: title.trim() || undefined,
          organization: organization.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          note: note.trim() || undefined,
        },
        `Save ${fullName.trim()}'s Contact`
      );
    } catch (err: any) {
      setError(err?.message || "Couldn't save contact card.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-ink/20 shadow-[0_2px_8px_rgba(10,10,10,0.06)]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck size={18} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[16px] font-semibold text-ink leading-tight">Digital Contact Card (.vcf)</h3>
            <p className="text-[12px] text-muted">Visitors can download and save your details to their phone contacts with one tap</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink flex items-center gap-1.5">
              <span>Full Name *</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink flex items-center gap-1.5">
              <Briefcase size={13} className="text-muted" />
              <span>Job Title / Role</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Creative Director"
              className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink flex items-center gap-1.5">
              <Building size={13} className="text-muted" />
              <span>Company / Studio</span>
            </label>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="e.g. Studio Nexus"
              className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink flex items-center gap-1.5">
              <Phone size={13} className="text-muted" />
              <span>Phone Number</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 234-5678"
              className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-[13px] font-medium text-ink flex items-center gap-1.5">
              <Mail size={13} className="text-muted" />
              <span>Contact Email</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@example.com"
              className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-[13px] font-medium text-ink flex items-center gap-1.5">
              <FileText size={13} className="text-muted" />
              <span>Personal Note / Intro</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Open for design collaborations and consulting"
              className="h-10 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        {error && (
          <p className="text-[13px] text-error" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Add Contact Card'}
          </Button>
          <Button type="button" variant="ghost" size="md" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
};
