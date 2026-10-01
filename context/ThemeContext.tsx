import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { lightColors, darkColors, type ThemeColors, type ThemeMode } from '../design-system/tokens';
export type { ThemeMode } from '../design-system/tokens';

interface ThemeContextType {
    mode: ThemeMode;
    toggleTheme: () => void;
    setTheme: (mode: ThemeMode) => void;
    colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [mode, setMode] = useState<ThemeMode>(() => {
        const saved = localStorage.getItem('nebula_theme_mode') as ThemeMode | null;
        if (saved === 'light' || saved === 'dark') return saved;
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
    });

    useEffect(() => {
        localStorage.setItem('nebula_theme_mode', mode);

        // Update document class for Tailwind dark mode
        if (mode === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        document.documentElement.setAttribute('data-theme', mode);

        // Update CSS custom properties for dynamic colors
        const colors = mode === 'light' ? lightColors : darkColors;
        Object.entries(colors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--theme-${key}`, value);
        });
    }, [mode]);

    const toggleTheme = () => {
        setMode(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const setTheme = (newMode: ThemeMode) => {
        setMode(newMode);
    };

    const colors = mode === 'light' ? lightColors : darkColors;

    return (
        <ThemeContext.Provider value={{ mode, toggleTheme, setTheme, colors }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
