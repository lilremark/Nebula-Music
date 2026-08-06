import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Platform } from './types';
import { createWebPlatform } from './web';

interface PlatformContextValue {
  platform: Platform | null;
}

const PlatformContext = createContext<PlatformContextValue>({ platform: null });

/**
 * Resolves the host platform: the web implementation by default, or the
 * Electron implementation when running inside the desktop shell (detected by
 * the preload-exposed `window.desktop`). The desktop module is dynamically
 * imported so the web bundle never contains it.
 */
export const PlatformProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [platform, setPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (window.desktop) {
      import('./desktop')
        .then((module) => {
          if (!cancelled) setPlatform(module.createDesktopPlatform());
        })
        .catch((error: unknown) => {
          console.error('Failed to initialize the desktop platform; using web fallback.', error);
          if (!cancelled) setPlatform(createWebPlatform());
        });
    } else {
      setPlatform(createWebPlatform());
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<PlatformContextValue>(() => ({ platform }), [platform]);

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
};

export const usePlatform = (): Platform | null => {
  const { platform } = useContext(PlatformContext);
  return platform;
};
