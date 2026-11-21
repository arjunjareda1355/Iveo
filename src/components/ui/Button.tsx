import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { Loader } from './Loader';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'inverse';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  iconRight?: React.ReactNode;
  as?: 'button' | 'a' | typeof Link;
  href?: string;
  to?: string;
  target?: string;
  rel?: string;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      iconRight,
      as: Component = 'button',
      href,
      to,
      target,
      rel,
      fullWidth = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isPrimary = variant === 'primary';
    const isSecondary = variant === 'secondary';
    const isDestructive = variant === 'destructive';
    const isGhost = variant === 'ghost';
    const isInverse = variant === 'inverse';

    const baseStyles =
      'group relative inline-flex items-center justify-center font-medium font-sans select-none whitespace-nowrap shrink-0 transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-offset-2';

    const sizeStyles =
      size === 'sm'
        ? 'h-9 min-h-[36px] px-3 text-[13px] rounded-[8px] gap-1.5 leading-none'
        : size === 'md'
          ? 'h-11 min-h-[44px] px-4 text-[14px] rounded-[10px] gap-2 leading-none'
          : 'h-12 min-h-[48px] px-5 text-[15px] rounded-[10px] gap-2 leading-none';

    const variantStyles = cn(
      isPrimary && [
        'bg-ink text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
        !disabled && 'hover:bg-ink-2 active:bg-black',
        'focus-visible:outline-ink',
      ],
      isSecondary && [
        'bg-surface text-ink border border-border-strong',
        !disabled && 'hover:bg-surface-2',
        'focus-visible:outline-ink',
      ],
      isDestructive && [
        'bg-surface text-[#B3261E] border border-[#FECACA]',
        !disabled && 'hover:bg-red-50 hover:border-[#B3261E]/50',
        'focus-visible:outline-[#B3261E]',
      ],
      isGhost && [
        'bg-transparent text-ink',
        !disabled && 'hover:bg-surface-2',
        'focus-visible:outline-ink',
      ],
      isInverse && [
        'bg-[#FAFAFA] text-ink',
        !disabled && 'hover:bg-[#E5E5E5] active:bg-[#D4D4D4]',
        'focus-visible:outline-[#FAFAFA]',
      ]
    );

    const stateStyles = disabled
      ? 'opacity-40 cursor-not-allowed pointer-events-none'
      : 'cursor-pointer';

    const widthStyles = fullWidth ? 'w-full' : '';

    const combinedClassName = cn(
      baseStyles,
      sizeStyles,
      variantStyles,
      stateStyles,
      widthStyles,
      className
    );

    const renderIconRight = () => {
      if (!iconRight) return null;
      return (
        <span className="shrink-0 inline-flex items-center transition-transform duration-120 ease-out group-hover:translate-x-[2px] motion-reduce:group-hover:translate-x-0">
          {iconRight}
        </span>
      );
    };

    const renderContent = () => (
      <>
        <span
          className={cn(
            'inline-flex items-center justify-center gap-[inherit]',
            loading && 'opacity-0'
          )}
        >
          {children}
          {renderIconRight()}
        </span>
        {loading && (
          <span
            className="absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <Loader size="xs" label="Loading" />
          </span>
        )}
      </>
    );

    if (Component === Link && to) {
      return (
        <Link
          to={to}
          target={target}
          rel={rel}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={combinedClassName}
          aria-disabled={disabled}
          {...(props as any)}
        >
          {renderContent()}
        </Link>
      );
    }

    if (Component === 'a' || href) {
      return (
        <a
          href={href}
          target={target}
          rel={rel}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={combinedClassName}
          aria-disabled={disabled}
          {...(props as any)}
        >
          {renderContent()}
        </a>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={combinedClassName}
        {...props}
      >
        {renderContent()}
      </button>
    );
  }
);

Button.displayName = 'Button';
