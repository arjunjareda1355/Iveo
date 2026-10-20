import React from 'react';
import { BlockLayout } from '../../data/types';
import { SegmentedControl } from '../ui/SegmentedControl';

interface LayoutControlProps {
  hasImage: boolean;
  layout: BlockLayout;
  onChange: (layout: BlockLayout) => void;
}

export const LayoutControl: React.FC<LayoutControlProps> = ({
  hasImage,
  layout,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[14px] font-medium text-ink">Layout</label>

      <div className="flex items-center gap-2">
        <SegmentedControl
          value={layout === 'featured' && hasImage ? 'featured' : 'classic'}
          onChange={(val) => {
            if (val === 'featured' && !hasImage) return;
            onChange(val as BlockLayout);
          }}
          options={[
            { value: 'classic', label: 'Classic' },
            {
              value: 'featured',
              label: 'Featured',
              disabled: !hasImage,
            },
          ]}
        />
      </div>

      {!hasImage && (
        <p className="text-[13px] text-muted">Add an image to use Featured.</p>
      )}
    </div>
  );
};
