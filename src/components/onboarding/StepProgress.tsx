import React from 'react';
import { copy } from '../../content/copy';

interface StepProgressProps {
  currentStep: 1 | 2 | 3;
}

export const StepProgress: React.FC<StepProgressProps> = ({ currentStep }) => {
  const labels = copy.onboarding.stepLabels;

  return (
    <div
      role="progressbar"
      aria-label="Onboarding progress"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={3}
      className="w-full flex flex-col gap-2 select-none"
    >
      {/* 3 bars */}
      <div className="flex items-center gap-2 w-full">
        {[1, 2, 3].map((step) => {
          const isDoneOrCurrent = step <= currentStep;
          return (
            <div
              key={step}
              className={`h-1 flex-1 rounded-[2px] transition-colors duration-200 ${
                isDoneOrCurrent ? 'bg-[#0A0A0A]' : 'bg-[#E5E5E5]'
              }`}
            />
          );
        })}
      </div>

      {/* 3 labels */}
      <div className="flex items-center justify-between font-mono text-[13px] text-muted">
        {labels.map((label, idx) => {
          const stepNum = idx + 1;
          const isCurrent = stepNum === currentStep;
          return (
            <span
              key={label}
              className={isCurrent ? 'text-ink font-medium' : 'text-muted'}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
};
