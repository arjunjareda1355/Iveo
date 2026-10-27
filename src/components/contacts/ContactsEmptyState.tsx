import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { copy } from '../../content/copy';
import { Mail, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ContactsEmptyStateProps {
  type: 'no_forms' | 'has_forms_empty' | 'search_empty';
  onClearSearch?: () => void;
}

export const ContactsEmptyState: React.FC<ContactsEmptyStateProps> = ({
  type,
  onClearSearch,
}) => {
  const navigate = useNavigate();

  if (type === 'search_empty') {
    return (
      <Card className="flex flex-col items-center justify-center text-center p-8 sm:p-12">
        <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-muted mb-3">
          <Search size={20} />
        </div>
        <p className="text-[15px] text-ink font-medium">
          {copy.contacts.searchEmpty}
        </p>
        {onClearSearch && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSearch}
            className="mt-3 text-muted hover:text-ink"
          >
            {copy.contacts.clearSearch}
          </Button>
        )}
      </Card>
    );
  }

  if (type === 'has_forms_empty') {
    return (
      <Card className="flex flex-col items-center justify-center text-center p-8 sm:p-12">
        <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-muted mb-3">
          <Mail size={22} />
        </div>
        <h3 className="text-[17px] font-semibold text-ink">
          {copy.contacts.emptyHasForms.heading}
        </h3>
        <p className="mt-1.5 text-[14px] text-muted max-w-sm">
          {copy.contacts.emptyHasForms.body}
        </p>
      </Card>
    );
  }

  // no_forms
  return (
    <Card className="flex flex-col items-center justify-center text-center p-8 sm:p-12">
      <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-muted mb-3">
        <Mail size={22} />
      </div>
      <h3 className="text-[17px] font-semibold text-ink">
        {copy.contacts.emptyNoForms.heading}
      </h3>
      <p className="mt-1.5 text-[14px] text-muted max-w-sm">
        {copy.contacts.emptyNoForms.body}
      </p>
      <div className="mt-5">
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate('/dashboard')}
        >
          {copy.contacts.emptyNoForms.button}
        </Button>
      </div>
    </Card>
  );
};
