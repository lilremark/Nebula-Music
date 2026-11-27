import React from 'react';
import { AnimatedSwitch } from '../vendor/spectrum-animated-switch';

/** Label and description on the left, the one compact (44x26) settings switch on the right. */
export const ToggleRow = ({ label, description, checked, onChange, disabled = false }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <div data-nebula-setting-toggle className="nebula-setting-row">
        <span className="nebula-setting-copy">
            <span className="nebula-setting-label">{label}</span>
            {description && <span className="nebula-setting-desc">{description}</span>}
        </span>
        <span className="nebula-setting-control">
            <AnimatedSwitch label={label} checked={checked} onCheckedChange={onChange} disabled={disabled} size="md" className="nebula-setting-switch" />
        </span>
    </div>
);
