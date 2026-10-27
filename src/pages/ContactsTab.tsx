import React, { useState } from 'react';
import { useAuth } from '@clerk/react';
import { useIvioSession } from '../auth/useIvioSession';
import { useUpgradeDialog } from '../components/plan/UpgradeDialogProvider';
import { useToast } from '../components/ui/Toast';
import { useBlocks } from '../data/BlocksContext';
import { useContacts } from '../data/hooks/useContacts';
import { useDeleteContact } from '../data/hooks/useDeleteContact';
import { useDeleteAllContacts } from '../data/hooks/useDeleteAllContacts';
import { fetchContactsForExport } from '../data/contactsApi';
import { buildContactsCsv } from '../lib/csv';
import { copy } from '../content/copy';
import { Contact } from '../data/types';
import { ContactsHeader } from '../components/contacts/ContactsHeader';
import { ContactSearch } from '../components/contacts/ContactSearch';
import { ContactsTable } from '../components/contacts/ContactsTable';
import { ContactsList } from '../components/contacts/ContactsList';
import { ContactsPagination } from '../components/contacts/ContactsPagination';
import { ContactsEmptyState } from '../components/contacts/ContactsEmptyState';
import { DeleteContactDialog } from '../components/contacts/DeleteContactDialog';
import { DeleteAllDialog } from '../components/contacts/DeleteAllDialog';
import { ProLockNotice } from '../components/plan/ProLockNotice';

export const ContactsTab: React.FC = () => {
  const { isPro, username } = useIvioSession();
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const { blocks } = useBlocks();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);

  const {
    rows,
    total,
    isLoading,
    isFetching,
    refetch,
    optimisticDelete,
    optimisticDeleteAll,
  } = useContacts({
    page,
    search,
    pageSize: 50,
  });

  const { deleteContact, isLoading: isDeletingSingle } = useDeleteContact();
  const { deleteAllContacts, isLoading: isDeletingAll } = useDeleteAllContacts();

  const hasSignupBlocks = blocks.some((b) => b.kind === 'signup');

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPage(1);
  };

  const handleExportCsv = async () => {
    if (isExporting || total === 0) return;
    setIsExporting(true);

    try {
      const token = await getToken({ template: 'supabase' }).catch(() => null);
      const allContacts = await fetchContactsForExport(token);

      if (allContacts.length >= 20000) {
        showToast(copy.contacts.toasts.csvCap);
      }

      const csvContent = buildContactsCsv(allContacts);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
        now.getDate()
      )}`;
      const fileName = `iveo-contacts-${username || 'export'}-${dateStr}.csv`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(copy.contacts.toasts.csvDownloaded);
    } catch {
      showToast(copy.contacts.toasts.csvError);
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmDeleteSingle = async () => {
    if (!deletingContact) return;
    const target = deletingContact;
    optimisticDelete(target.id);
    setDeletingContact(null);

    try {
      await deleteContact(target.id);
      showToast(copy.contacts.toasts.deleted);
    } catch {
      showToast(copy.contacts.toasts.deleteError);
      refetch();
    }
  };

  const handleConfirmDeleteAll = async () => {
    optimisticDeleteAll();
    setIsDeleteAllOpen(false);

    try {
      await deleteAllContacts();
      showToast(copy.contacts.toasts.allDeleted);
    } catch {
      showToast(copy.contacts.toasts.deleteError);
      refetch();
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <ContactsHeader
        total={total}
        isPro={isPro}
        isExporting={isExporting}
        onExportCsv={handleExportCsv}
        onDeleteAll={() => setIsDeleteAllOpen(true)}
      />

      {/* Pro Lock Notice for free tier */}
      {!isPro && <ProLockNotice feature="contact_forms" />}

      {/* Search Bar (visible if contacts exist or search is active) */}
      {(total > 0 || search) && (
        <div className="flex items-center justify-between gap-4">
          <ContactSearch
            value={search}
            onChange={handleSearchChange}
          />
          {isFetching && (
            <div className="text-[12px] text-muted animate-pulse">
              Updating...
            </div>
          )}
        </div>
      )}

      {/* Content Area */}
      {isLoading ? (
        <div className="py-16 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-ink border-t-transparent animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        search ? (
          <ContactsEmptyState
            type="search_empty"
            onClearSearch={() => handleSearchChange('')}
          />
        ) : hasSignupBlocks ? (
          <ContactsEmptyState type="has_forms_empty" />
        ) : (
          <ContactsEmptyState type="no_forms" />
        )
      ) : (
        <div className="flex flex-col gap-4">
          <ContactsTable
            contacts={rows}
            onDeleteContact={(c) => setDeletingContact(c)}
          />
          <ContactsList
            contacts={rows}
            onDeleteContact={(c) => setDeletingContact(c)}
          />
          <ContactsPagination
            page={page}
            pageSize={50}
            total={total}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}

      {/* Footnote */}
      <p className="text-[12px] text-muted text-center pt-4">
        {copy.contacts.footnote}
      </p>

      {/* Dialogs */}
      <DeleteContactDialog
        isOpen={deletingContact !== null}
        contact={deletingContact}
        isLoading={isDeletingSingle}
        onConfirm={handleConfirmDeleteSingle}
        onClose={() => setDeletingContact(null)}
      />

      <DeleteAllDialog
        isOpen={isDeleteAllOpen}
        isLoading={isDeletingAll}
        onConfirm={handleConfirmDeleteAll}
        onClose={() => setIsDeleteAllOpen(false)}
      />
    </div>
  );
};

export default ContactsTab;
