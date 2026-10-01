import React from 'react';

/** Extracted unchanged from Settings; the production view and gallery share this panel. */
export const SettingPanel = ({
    icon: Icon,
    title,
    description,
    children,
    className = '',
}: {
    icon: React.ElementType;
    title: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}) => {
    const panelId = `settings-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

    return (
    <section
        id={panelId}
        data-nebula-settings-panel={panelId}
        aria-labelledby={`${panelId}-title`}
        className={`grid overflow-hidden rounded-lg border border-neutral-200 bg-white/70 shadow-xs dark:border-white/10 dark:bg-neutral-900/50 lg:grid-cols-[260px_minmax(0,1fr)] ${className}`}
    >
        <div data-nebula-settings-panel-heading className="flex items-start gap-3 border-b border-neutral-200 bg-neutral-100/70 px-5 py-4 dark:border-white/10 dark:bg-white/[0.03] lg:border-b-0 lg:border-r">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <h2 id={`${panelId}-title`} className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white">{title}</h2>
                {description && <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-white/50">{description}</p>}
            </div>
        </div>
        <div data-nebula-settings-panel-body className="min-w-0 divide-y divide-neutral-200 dark:divide-white/10">
            {children}
        </div>
    </section>
    );
};
