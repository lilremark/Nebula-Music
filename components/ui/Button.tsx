import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    glow?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    children?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary: `
    bg-gradient-to-r from-primary to-primary/90 text-black font-bold
    hover:from-white hover:to-white hover:shadow-glow
    shadow-lg shadow-primary/20
  `,
    secondary: `
    bg-neutral-100 backdrop-blur-md text-neutral-900 font-medium
    border border-neutral-200 hover:bg-neutral-200 hover:border-neutral-300
    dark:bg-white/5 dark:text-white dark:border-white/10 dark:hover:bg-white/10 dark:hover:border-white/20
  `,
    ghost: `
    bg-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100
    dark:text-neutral-400 dark:hover:text-white dark:hover:bg-white/5
  `,
    icon: `
    bg-neutral-100 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200
    dark:bg-white/5 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-white/10
    aspect-square justify-center
  `,
};

const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-4 py-2 text-xs gap-1.5',
    md: 'px-6 py-3 text-sm gap-2',
    lg: 'px-8 py-4 text-base gap-2.5',
};

const iconSizeClasses: Record<ButtonSize, string> = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
};

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    glow = false,
    loading = false,
    icon,
    children,
    className = '',
    disabled,
    ...props
}) => {
    const isIconOnly = variant === 'icon';

    return (
        <button
            className={`
        inline-flex items-center rounded-full
        transition-all duration-200 ease-out
        active:scale-95 disabled:opacity-50 disabled:pointer-events-none
        focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900
        ${variantClasses[variant]}
        ${isIconOnly ? iconSizeClasses[size] : sizeClasses[size]}
        ${glow ? 'hover:shadow-glow animate-glow-pulse' : ''}
        ${className}
      `}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
                <>
                    {icon && <span className="shrink-0">{icon}</span>}
                    {children}
                </>
            )}
        </button>
    );
};

export default Button;
