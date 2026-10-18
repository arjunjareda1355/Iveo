import React from 'react';
import { cn } from '../../lib/cn';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export const Container: React.FC<ContainerProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn('mx-auto w-full max-w-[1120px] px-6 sm:px-8', className)}
      {...props}
    >
      {children}
    </div>
  );
};
