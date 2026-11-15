import React from 'react';
import { Contact } from '../../data/types';
import { copy } from '../../content/copy';
import { Trash2, Mail, Phone, Calendar, FileText } from 'lucide-react';

interface ContactsListProps {
  contacts: Contact[];
  onDeleteContact: (contact: Contact) => void;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export const ContactsList: React.FC<ContactsListProps> = ({
  contacts,
  onDeleteContact,
}) => {
  return (
    <div className="md:hidden flex flex-col gap-2.5 w-full">
      {contacts.map((c) => (
        <div
          key={c.id}
          className="p-3.5 bg-surface border border-border rounded-[12px] flex flex-col gap-2 text-[14px]"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col min-w-0">
              {c.email && (
                <div className="flex items-center gap-1.5 font-medium text-ink truncate">
                  <Mail size={14} className="text-muted shrink-0" />
                  <span className="truncate">{c.email}</span>
                </div>
              )}
              {c.phone && (
                <div className="flex items-center gap-1.5 text-ink font-mono text-[13px] truncate">
                  <Phone size={14} className="text-muted shrink-0" />
                  <span className="truncate">{c.phone}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onDeleteContact(c)}
              aria-label={copy.contacts.deleteContactAria}
              className="p-1.5 text-muted hover:text-error hover:bg-red-50 rounded-[8px] transition-colors shrink-0 cursor-pointer"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 border-t border-border/60 text-[12px] text-muted">
            <div className="flex items-center gap-1 truncate max-w-[180px]">
              <FileText size={12} className="shrink-0" />
              <span className="truncate">
                {c.formTitle || copy.contacts.deletedForm}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Calendar size={12} className="shrink-0" />
              <span>{formatDate(c.createdAt)}</span>
            </div>

            {c.source && (
              <span className="capitalize px-1.5 py-0.5 rounded bg-surface-2">
                {c.source}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
