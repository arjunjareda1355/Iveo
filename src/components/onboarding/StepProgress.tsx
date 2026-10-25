import React from 'react';

interface StepProgressProps {
  currentStep: number;
  totalSteps?: number;
  labels?: readonly string[];
}

export const StepProgress: React.FC<StepProgressProps> = ({
  currentStep,
  totalSteps = 5,
  labels = ['Address', 'Profile', 'Craft', 'Links', 'Vibe'],
}) => {
  const count = labels.length || totalSteps;

  return (
    <div
      role="progressbar"
      aria-label="Profile setup progress"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={count}
      className="w-full flex flex-col gap-2 select-none"
    >
      {/* Bars */}
      <div className="flex items-center gap-1.5 w-full">
        {Array.from({ length: count }, (_, i) => i + 1).map((step) => {
          const isDoneOrCurrent = step <= currentStep;
          return (
            <div
              key={step}
              className={`h-1 flex-1 rounded-[2px] transition-colors duration-200 ${
                isDoneOrCurrent ? 'bg-ink' : 'bg-border'
              }`}
            />
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between font-mono text-[12px] text-muted">
        {labels.map((label, idx) => {
          const stepNum = idx + 1;
          const isCurrent = stepNum === currentStep;
          const isPast = stepNum < currentStep;
          return (
            <span
              key={label}
              className={`transition-colors ${
                isCurrent
                  ? 'text-ink font-semibold'
                  : isPast
                  ? 'text-ink-2 font-medium'
                  : 'text-subtle'
              }`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
};
