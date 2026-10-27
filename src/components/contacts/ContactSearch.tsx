import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { copy } from '../../content/copy';

interface ContactSearchProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export const ContactSearch: React.FC<ContactSearchProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (internalValue !== value) {
        onChange(internalValue);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [internalValue, value, onChange]);

  const handleClear = () => {
    setInternalValue('');
    onChange('');
  };

  return (
    <div className={`relative w-full max-w-sm ${className}`}>
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
      />
      <input
        type="search"
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        placeholder={copy.contacts.searchPlaceholder}
        aria-label={copy.contacts.searchAriaLabel}
        className="w-full h-10 pl-9 pr-9 text-[14px] bg-surface border border-border rounded-[10px] text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-ink"
      />
      {internalValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={copy.contacts.clearSearch}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-0.5"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
};
