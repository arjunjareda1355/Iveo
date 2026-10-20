import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'inverse';
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
    const isGhost = variant === 'ghost';
    const isInverse = variant === 'inverse';

    const baseStyles =
      'group inline-flex items-center justify-center font-medium font-sans select-none transition-colors duration-120 focus-visible:outline-2 focus-visible:outline-offset-2';

    const sizeStyles =
      size === 'sm'
        ? 'h-8 px-3 text-[13px] rounded-[8px] gap-1.5 leading-none'
        : size === 'md'
          ? 'h-10 px-4 text-[14px] rounded-[10px] gap-2 leading-none'
          : 'h-12 px-5 text-[15px] rounded-[10px] gap-2 leading-none';

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

    const renderSpinner = () => (
      <svg
        className="w-4 h-4 animate-spin motion-reduce:animate-none shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="1.5"
          className="opacity-25"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );

    const renderIcon = () => {
      if (loading) {
        return renderSpinner();
      }
      if (!iconRight) return null;

      return (
        <span className="shrink-0 inline-flex items-center transition-transform duration-120 ease-out group-hover:translate-x-[2px] motion-reduce:group-hover:translate-x-0">
          {iconRight}
        </span>
      );
    };

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
          <span>{children}</span>
          {renderIcon()}
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
          <span>{children}</span>
          {renderIcon()}
        </a>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        disabled={disabled || loading}
        className={combinedClassName}
        {...props}
      >
        <span>{children}</span>
        {renderIcon()}
      </button>
    );
  }
);

Button.displayName = 'Button';
