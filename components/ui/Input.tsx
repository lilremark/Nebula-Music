import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    icon?: React.ReactNode;
    iconPosition?: 'left' | 'right';
    error?: string;
    clearable?: boolean;
    onClear?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
    icon,
    iconPosition = 'left',
    error,
    clearable = false,
    onClear,
    className = '',
    value,
    ...props
}, ref) => {
    const hasIcon = !!icon;
    const showClear = clearable && value;

    return (
        <div className="relative w-full group">
            {hasIcon && iconPosition === 'left' && (
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-primary transition-colors pointer-events-none">
                    {icon}
                </div>
            )}

            <input
                ref={ref}
                value={value}
                className={`
          w-full bg-white text-neutral-900 placeholder-neutral-500
          border border-neutral-300 rounded-xl
          py-2.5 text-sm font-medium
          transition-all duration-200
          focus:bg-white focus:border-primary/60 focus:outline-hidden
          focus:ring-2 focus:ring-primary/20
          hover:bg-neutral-50 hover:border-neutral-400
          dark:bg-white/5 dark:text-white dark:placeholder-white/20 dark:border-white/10
          dark:focus:bg-white/8 dark:focus:border-primary/50
          dark:hover:bg-white/8 dark:hover:border-white/15
          ${hasIcon && iconPosition === 'left' ? 'pl-10' : 'pl-4'}
          ${hasIcon && iconPosition === 'right' || showClear ? 'pr-10' : 'pr-4'}
          ${error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : ''}
          ${className}
        `}
                {...props}
            />

            {hasIcon && iconPosition === 'right' && !showClear && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-primary transition-colors pointer-events-none">
                    {icon}
                </div>
            )}

            {showClear && (
                <button
                    type="button"
                    onClick={onClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 dark:hover:text-white dark:hover:bg-white/10 transition-all"
                    aria-label="Clear input"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}

            {error && (
                <p className="mt-1.5 text-xs text-red-400 font-medium">{error}</p>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;
