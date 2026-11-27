import React from 'react';

/**
 * A settings group: a 260px heading column (icon tile, title, description)
 * beside its rows, stacking above them when the content pane is narrow.
 * Layout and colours live in next-ui.css ([data-nebula-settings-panel*]).
 */
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
        className={className || undefined}
    >
        <div data-nebula-settings-panel-heading>
            <div className="nebula-setting-icon" aria-hidden="true">
                <Icon />
            </div>
            <div className="min-w-0">
                <h2 id={`${panelId}-title`}>{title}</h2>
                {description && <p>{description}</p>}
            </div>
        </div>
        <div data-nebula-settings-panel-body>
            {children}
        </div>
    </section>
    );
};
