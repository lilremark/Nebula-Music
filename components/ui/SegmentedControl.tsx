import React from 'react';

export interface SegmentedOption<T extends string> {
    value: T;
    label: string;
    icon?: React.ElementType;
}

/**
 * The one segmented-control look used across Settings, setup and modals
 * (styled by `.nebula-segmented` in next-ui.css): a tinted well with the
 * selected segment raised, sentence-case labels, 40px tall.
 */
export function SegmentedControl<T extends string>({
    value,
    options,
    onChange,
    ariaLabel,
    disabled = false,
    stretch = false,
    className = '',
}: {
    value: T;
    options: readonly SegmentedOption<T>[];
    onChange: (value: T) => void;
    ariaLabel: string;
    disabled?: boolean;
    /** Segments share the full available width instead of hugging their labels. */
    stretch?: boolean;
    className?: string;
}) {
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            data-stretch={stretch ? 'true' : undefined}
            className={`nebula-segmented ${className}`}
        >
            {options.map(option => {
                const Icon = option.icon;
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={value === option.value}
                        disabled={disabled}
                        onClick={() => onChange(option.value)}
                    >
                        {Icon && <Icon aria-hidden="true" />}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
