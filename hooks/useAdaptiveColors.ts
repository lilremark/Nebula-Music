import { useState, useEffect, useCallback, useRef } from 'react';

interface AdaptiveColors {
    primary: string;
    primaryMuted: string;
    secondary: string;
    surface: string;
    surfaceHover: string;
    text: string;
    textMuted: string;
    gradient: string;
}

interface ColorCache {
    [url: string]: AdaptiveColors;
}

const colorCache: ColorCache = {};

// Default monochrome palette when no album art
const defaultColors: AdaptiveColors = {
    primary: '#ffffff',
    primaryMuted: 'rgba(255, 255, 255, 0.7)',
    secondary: '#a0a0a0',
    surface: 'rgba(255, 255, 255, 0.05)',
    surfaceHover: 'rgba(255, 255, 255, 0.1)',
    text: '#ffffff',
    textMuted: 'rgba(255, 255, 255, 0.6)',
    gradient: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
};

const clampChannel = (value: number): number => Math.min(255, Math.max(0, Math.round(value)));

// Calculate relative luminance for contrast calculations
const getLuminance = (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map(channel => {
        let c = clampChannel(channel);
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

// Check if color is light or dark
const isLightColor = (r: number, g: number, b: number): boolean => {
    return getLuminance(r, g, b) > 0.5;
};

// Adjust color saturation
const adjustSaturation = (r: number, g: number, b: number, factor: number): [number, number, number] => {
    const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
    return [
        clampChannel(gray + factor * (r - gray)),
        clampChannel(gray + factor * (g - gray)),
        clampChannel(gray + factor * (b - gray)),
    ];
};

// Darken or lighten a color
const adjustBrightness = (r: number, g: number, b: number, factor: number): [number, number, number] => {
    return [
        clampChannel(r * factor),
        clampChannel(g * factor),
        clampChannel(b * factor),
    ];
};

// Convert RGB to hex
const rgbToHex = (r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map(channel => clampChannel(channel).toString(16).padStart(2, '0')).join('');
};

// Extract dominant colors from image using canvas
const extractColors = async (imageUrl: string): Promise<AdaptiveColors> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(defaultColors);
                return;
            }

            // Sample at lower resolution for performance
            const size = 50;
            canvas.width = size;
            canvas.height = size;
            ctx.drawImage(img, 0, 0, size, size);

            const imageData = ctx.getImageData(0, 0, size, size).data;

            // Simple color quantization - find most frequent colors
            const colorBuckets: { [key: string]: { r: number; g: number; b: number; count: number } } = {};

            for (let i = 0; i < imageData.length; i += 4) {
                const r = Math.floor(imageData[i] / 32) * 32;
                const g = Math.floor(imageData[i + 1] / 32) * 32;
                const b = Math.floor(imageData[i + 2] / 32) * 32;
                const key = `${r},${g},${b}`;

                if (!colorBuckets[key]) {
                    colorBuckets[key] = { r, g, b, count: 0 };
                }
                colorBuckets[key].count++;
            }

            // Sort by frequency and get top colors
            const sortedColors = Object.values(colorBuckets)
                .filter(c => {
                    // Filter out very dark and very light colors for better accent
                    const lum = getLuminance(c.r, c.g, c.b);
                    return lum > 0.05 && lum < 0.9;
                })
                .sort((a, b) => b.count - a.count);

            if (sortedColors.length === 0) {
                resolve(defaultColors);
                return;
            }

            const dominant = sortedColors[0];
            const secondary = sortedColors[1] || dominant;

            // Boost saturation for more vivid colors
            const [pr, pg, pb] = adjustSaturation(dominant.r, dominant.g, dominant.b, 1.3);
            const [sr, sg, sb] = adjustSaturation(secondary.r, secondary.g, secondary.b, 1.2);

            // Create darker surface color
            const [surfR, surfG, surfB] = adjustBrightness(pr, pg, pb, 0.15);
            const [surfHR, surfHG, surfHB] = adjustBrightness(pr, pg, pb, 0.25);

            // Determine text color based on primary brightness
            const textColor = isLightColor(pr, pg, pb) ? '#000000' : '#ffffff';
            const textMuted = isLightColor(pr, pg, pb) ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)';

            resolve({
                primary: rgbToHex(pr, pg, pb),
                primaryMuted: `rgba(${pr}, ${pg}, ${pb}, 0.7)`,
                secondary: rgbToHex(sr, sg, sb),
                surface: `rgba(${surfR}, ${surfG}, ${surfB}, 0.3)`,
                surfaceHover: `rgba(${surfHR}, ${surfHG}, ${surfHB}, 0.4)`,
                text: textColor,
                textMuted: textMuted,
                gradient: `linear-gradient(135deg, rgb(${surfR}, ${surfG}, ${surfB}) 0%, rgb(10, 10, 10) 100%)`,
            });
        };

        img.onerror = () => {
            resolve(defaultColors);
        };

        img.src = imageUrl;
    });
};

export const useAdaptiveColors = (imageUrl: string | undefined) => {
    const [colors, setColors] = useState<AdaptiveColors>(defaultColors);
    const [isLoading, setIsLoading] = useState(false);
    const prevUrlRef = useRef<string | undefined>(undefined);

    const updateColors = useCallback(async (url: string) => {
        // Check cache first
        if (colorCache[url]) {
            setColors(colorCache[url]);
            return;
        }

        setIsLoading(true);
        const extractedColors = await extractColors(url);
        colorCache[url] = extractedColors;
        setColors(extractedColors);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (!imageUrl) {
            setColors(defaultColors);
            return;
        }

        // Don't re-extract if URL hasn't changed
        if (prevUrlRef.current === imageUrl) return;
        prevUrlRef.current = imageUrl;

        updateColors(imageUrl);
    }, [imageUrl, updateColors]);

    // Apply colors to CSS custom properties
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--adaptive-primary', colors.primary);
        root.style.setProperty('--adaptive-primary-muted', colors.primaryMuted);
        root.style.setProperty('--adaptive-secondary', colors.secondary);
        root.style.setProperty('--adaptive-surface', colors.surface);
        root.style.setProperty('--adaptive-surface-hover', colors.surfaceHover);
        root.style.setProperty('--adaptive-text', colors.text);
        root.style.setProperty('--adaptive-text-muted', colors.textMuted);
        root.style.setProperty('--adaptive-gradient', colors.gradient);
    }, [colors]);

    return { colors, isLoading, defaultColors };
};

export type { AdaptiveColors };
