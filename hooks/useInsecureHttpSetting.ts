import { useEffect, useState } from 'react';
import { usePlatform } from '../platform/PlatformContext';

export const isInsecureHttpUrl = (value: string) => {
    try { return new URL(value.trim()).protocol === 'http:'; }
    catch { return false; }
};

export const useInsecureHttpSetting = () => {
    const platform = usePlatform();
    const isDesktop = platform?.info.kind === 'desktop';
    const [allowed, setAllowed] = useState(false);
    const [ready, setReady] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setReady(false);
        if (!isDesktop || !platform) return;
        platform.settings.get('permitInsecureHttp').then(value => {
            if (!cancelled) { setAllowed(value === true); setReady(true); }
        }).catch(() => {
            if (!cancelled) setError('Could not load the HTTP connection setting.');
        });
        return () => { cancelled = true; };
    }, [platform, isDesktop]);

    const change = async (value: boolean) => {
        if (!platform || !isDesktop || saving || !ready) return;
        setSaving(true);
        setError('');
        try {
            await platform.settings.set('permitInsecureHttp', value);
            setAllowed(value);
        } catch {
            setError('Could not save the HTTP connection setting.');
        } finally { setSaving(false); }
    };

    return {
        isDesktop, allowed, ready, saving, error, change,
        canConnect: (url: string) => !isInsecureHttpUrl(url) || (!!platform && (!isDesktop || (ready && !saving && allowed))),
    };
};
