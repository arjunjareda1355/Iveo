import React, { useState } from 'react';
import { HelpCircle, Plus, Trash2 } from 'lucide-react';
import { FaqItem } from '../../data/types';
import { Button } from '../ui/Button';

interface FaqComposerProps {
  onAdd: (items: FaqItem[], title: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialItems?: FaqItem[];
  initialTitle?: string;
  isEditing?: boolean;
}

export const FaqComposer: React.FC<FaqComposerProps> = ({
  onAdd,
  onCancel,
  isSubmitting = false,
  initialItems,
  initialTitle,
  isEditing = false,
}) => {
  const [title, setTitle] = useState(initialTitle || 'Frequently Asked Questions');
  const [items, setItems] = useState<FaqItem[]>(
    initialItems && initialItems.length > 0
      ? initialItems
      : [
          {
            id: crypto.randomUUID(),
            question: 'What services or products do you offer?',
            answer: 'Check out the links above for my portfolio, booking calendar, and latest projects.',
          },
          {
            id: crypto.randomUUID(),
            question: 'How can I get in touch?',
            answer: 'Reach out via the email or socials at the top of this page.',
          },
        ]
  );
  const [error, setError] = useState<string | null>(null);

  const handleUpdateItem = (id: string, field: 'question' | 'answer', value: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        question: '',
        answer: '',
      },
    ]);
  };

  const handleDeleteItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validItems = items.filter((it) => it.question.trim().length > 0 && it.answer.trim().length > 0);
    if (validItems.length === 0) {
      setError('Please add at least one question and answer.');
      return;
    }

    try {
      await onAdd(validItems, title.trim() || 'Frequently Asked Questions');
    } catch (err: any) {
      setError(err?.message || "Couldn't create FAQ block. Try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 bg-surface border border-border rounded-xl shadow-xs">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <HelpCircle size={18} className="text-blue-500" />
        <h3 className="text-sm font-semibold text-ink">Add FAQ / Accordion Block</h3>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-ink/80">FAQ Section Heading</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Frequently Asked Questions"
          maxLength={50}
          className="text-xs px-3 py-2 bg-surface border border-border rounded-lg text-ink focus:outline-none focus:ring-1 focus:ring-ink"
        />
      </div>

      {/* Questions Stack */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium text-ink/80">Questions & Answers</label>
        {items.map((item, index) => (
          <div key={item.id} className="flex flex-col gap-2 p-3 bg-neutral-50 dark:bg-neutral-900 border border-border/80 rounded-lg relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted">Q{index + 1}</span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className="text-muted hover:text-red-500 transition-colors p-1"
                  title="Remove question"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <input
              type="text"
              value={item.question}
              onChange={(e) => handleUpdateItem(item.id, 'question', e.target.value)}
              placeholder="Question"
              className="text-xs px-2.5 py-1.5 bg-surface border border-border rounded-md text-ink focus:outline-none focus:ring-1 focus:ring-ink"
            />

            <textarea
              value={item.answer}
              onChange={(e) => handleUpdateItem(item.id, 'answer', e.target.value)}
              placeholder="Answer"
              rows={2}
              className="text-xs px-2.5 py-1.5 bg-surface border border-border rounded-md text-ink focus:outline-none focus:ring-1 focus:ring-ink resize-none"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddItem}
          className="self-start text-xs font-medium text-ink flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <Plus size={14} />
          <span>Add Question</span>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <Button variant="ghost" size="sm" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEditing ? 'Save changes' : 'Add FAQ'}
        </Button>
      </div>
    </form>
  );
};
