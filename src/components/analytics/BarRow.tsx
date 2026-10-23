import React from 'react';

interface BarRowProps {
  ratio: number; // 0 to 1
  className?: string;
}

export const BarRow: React.FC<BarRowProps> = ({ ratio, className }) => {
  const clampedRatio = Math.max(0, Math.min(1, isNaN(ratio) ? 0 : ratio));
  const widthPercent = `${(clampedRatio * 100).toFixed(1)}%`;

  return (
    <div
      aria-hidden="true"
      className={`w-full h-1 bg-[#E5E5E5] rounded-[2px] overflow-hidden ${className || ''}`}
    >
      <div
        className="h-full bg-ink rounded-[2px] transition-all duration-150"
        style={{ width: widthPercent }}
      />
    </div>
  );
};
