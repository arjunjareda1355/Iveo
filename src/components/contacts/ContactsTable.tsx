import React from 'react';
import { Contact } from '../../data/types';
import { copy } from '../../content/copy';
import { Trash2 } from 'lucide-react';

interface ContactsTableProps {
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

export const ContactsTable: React.FC<ContactsTableProps> = ({
  contacts,
  onDeleteContact,
}) => {
  return (
    <div className="hidden md:block w-full overflow-x-auto rounded-[12px] border border-border bg-surface">
      <table className="w-full text-left text-[14px]">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-muted text-[12px] font-medium uppercase tracking-wider">
            <th className="py-3 px-4 font-medium">{copy.contacts.headers.date}</th>
            <th className="py-3 px-4 font-medium">{copy.contacts.headers.email}</th>
            <th className="py-3 px-4 font-medium">{copy.contacts.headers.phone}</th>
            <th className="py-3 px-4 font-medium">{copy.contacts.headers.form}</th>
            <th className="py-3 px-4 font-medium">{copy.contacts.headers.source}</th>
            <th className="py-3 px-4 font-medium text-right w-16">
              <span className="sr-only">{copy.contacts.headers.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {contacts.map((c) => (
            <tr key={c.id} className="hover:bg-surface-2/60 transition-colors">
              <td className="py-3 px-4 whitespace-nowrap text-muted text-[13px]">
                {formatDate(c.createdAt)}
              </td>
              <td className="py-3 px-4 font-medium text-ink">
                {c.email || <span className="text-muted font-normal">—</span>}
              </td>
              <td className="py-3 px-4 text-ink font-mono text-[13px]">
                {c.phone || <span className="text-muted font-sans font-normal">—</span>}
              </td>
              <td className="py-3 px-4 text-ink max-w-[200px] truncate" title={c.formTitle || copy.contacts.deletedForm}>
                {c.formTitle || <span className="text-muted italic">{copy.contacts.deletedForm}</span>}
              </td>
              <td className="py-3 px-4 text-muted text-[13px] capitalize">
                {c.source || '—'}
              </td>
              <td className="py-3 px-4 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onDeleteContact(c)}
                  aria-label={copy.contacts.deleteContactAria}
                  className="p-1.5 text-muted hover:text-error hover:bg-red-50 rounded-[8px] transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
