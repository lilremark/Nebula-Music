import React from 'react';
import { AnimatedSwitch } from '../vendor/spectrum-animated-switch';

export const ToggleRow = ({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div
        data-nebula-setting-toggle
        className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-neutral-100 dark:hover:bg-white/5 w-full text-left"
    >
        <span className="min-w-0">
            <span className="block text-sm font-semibold text-neutral-900 dark:text-white">{label}</span>
            {description && <span className="mt-1 block text-xs leading-relaxed text-neutral-600 dark:text-white/50">{description}</span>}
        </span>
        <AnimatedSwitch label={label} checked={checked} onCheckedChange={onChange} size="lg" className="nebula-setting-switch" />
    </div>
);
