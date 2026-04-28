import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'nebula_waveform_v4:';
const WAVEFORM_SAMPLES = 180;

interface WaveformCacheEntry {
    version: 4;
    peaks: number[];
    updatedAt: number;
}

const memoryCache = new Map<string, number[]>();
const inFlight = new Map<string, Promise<number[]>>();

const FALLBACK_WAVEFORM = Array.from({ length: WAVEFORM_SAMPLES }, (_, i) => {
    const phase = i / WAVEFORM_SAMPLES;
    const wave = Math.abs(Math.sin(phase * Math.PI * 6));
    return 0.12 + wave * 0.45;
});

const normalizePeaks = (peaks: number[]) => {
    if (!peaks.length) return [...FALLBACK_WAVEFORM];
    const maxPeak = Math.max(...peaks, 0.001);
    return peaks.map((peak) => Math.min(1, Math.max(0.01, peak / maxPeak)));
};

const getWaveformCacheKey = (songId: string, streamUrl: string) => {
    try {
        const url = new URL(streamUrl);
        const trackId = url.searchParams.get('id') || songId;
        const format = url.searchParams.get('format') || 'source';
        return `${url.origin}${url.pathname}|${trackId}|${format}`;
    } catch {
        return songId;
    }
};

const readCachedWaveform = (cacheKey: string): number[] | null => {
    try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${cacheKey}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as WaveformCacheEntry;
        if (parsed?.version !== 4 || !Array.isArray(parsed.peaks)) return null;
        const peaks = normalizePeaks(parsed.peaks);
        memoryCache.set(cacheKey, peaks);
        return peaks;
    } catch {
        return null;
    }
};

const writeCachedWaveform = (cacheKey: string, peaks: number[]) => {
    const normalized = normalizePeaks(peaks);
    memoryCache.set(cacheKey, normalized);
    try {
        const payload: WaveformCacheEntry = {
            version: 4,
            peaks: normalized,
            updatedAt: Date.now(),
        };
        localStorage.setItem(`${STORAGE_PREFIX}${cacheKey}`, JSON.stringify(payload));
    } catch {
        // Ignore storage limits/errors and keep in-memory cache.
    }
};

const buildWaveformFromBuffer = (audioBuffer: AudioBuffer) => {
    const blockSize = Math.max(1, Math.floor(audioBuffer.length / WAVEFORM_SAMPLES));
    const channels: Float32Array[] = [];
    const peaks: number[] = new Array(WAVEFORM_SAMPLES).fill(0);

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
        channels.push(audioBuffer.getChannelData(channel));
    }

    for (let i = 0; i < WAVEFORM_SAMPLES; i += 1) {
        const start = i * blockSize;
        const end = Math.min(audioBuffer.length, start + blockSize);
        let squareSum = 0;
        let samples = 0;

        for (let j = start; j < end; j += 1) {
            let monoSample = 0;
            for (let channel = 0; channel < channels.length; channel += 1) {
                monoSample += channels[channel][j] || 0;
            }
            monoSample /= Math.max(1, channels.length);
            squareSum += monoSample * monoSample;
            samples += 1;
        }

        const rms = samples > 0 ? Math.sqrt(squareSum / samples) : 0;
        peaks[i] = rms;
    }

    // Light smoothing to avoid jagged "spike-only" look.
    const smoothed = peaks.map((value, index) => {
        const prev = peaks[index - 1] ?? value;
        const next = peaks[index + 1] ?? value;
        return (prev + value * 2 + next) / 4;
    });

    // Perceptual compression keeps quieter parts visible like SoundCloud bars.
    const compressed = smoothed.map((value) => Math.pow(value, 0.55));

    return normalizePeaks(compressed);
};

const decodeWaveform = async (streamUrl: string) => {
    const response = await fetch(streamUrl, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Waveform fetch failed: ${response.status}`);

    const audioData = await response.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio API not available');

    const audioContext = new AudioContextClass();
    try {
        const decoded = await audioContext.decodeAudioData(audioData.slice(0));
        return buildWaveformFromBuffer(decoded);
    } finally {
        audioContext.close().catch(() => undefined);
    }
};
const getOrCreateWaveform = async (cacheKey: string, streamUrl: string) => {
    if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey)!;

    const cached = readCachedWaveform(cacheKey);
    if (cached) return cached;

    if (inFlight.has(cacheKey)) return inFlight.get(cacheKey)!;

    const promise = decodeWaveform(streamUrl)
        .then((peaks) => {
            writeCachedWaveform(cacheKey, peaks);
            return peaks;
        })
        .catch((error) => {
            console.warn('Waveform unavailable, using fallback for this session', error);
            return [...FALLBACK_WAVEFORM];
        })
        .finally(() => {
            inFlight.delete(cacheKey);
        });

    inFlight.set(cacheKey, promise);
    return promise;
};

export const useTrackWaveform = (songId?: string, streamUrl?: string | null) => {
    const [waveform, setWaveform] = useState<number[] | null>(FALLBACK_WAVEFORM);

    useEffect(() => {
        let cancelled = false;
        let timeoutId: number | null = null;
        let idleId: number | null = null;

        if (!songId || !streamUrl) {
            setWaveform(FALLBACK_WAVEFORM);
            return () => {
                cancelled = true;
            };
        }

        const cacheKey = getWaveformCacheKey(songId, streamUrl);
        const cached = memoryCache.get(cacheKey) || readCachedWaveform(cacheKey);
        if (cached) {
            setWaveform(cached);
        } else {
            setWaveform(FALLBACK_WAVEFORM);
        }

        const loadWaveform = () => {
            getOrCreateWaveform(cacheKey, streamUrl).then((peaks) => {
                if (!cancelled) setWaveform(peaks);
            });
        };

        const requestIdle = (window as any).requestIdleCallback as ((callback: () => void, options?: { timeout: number }) => number) | undefined;
        const cancelIdle = (window as any).cancelIdleCallback as ((id: number) => void) | undefined;
        if (!cached && requestIdle) {
            idleId = requestIdle(loadWaveform, { timeout: 1500 });
        } else if (!cached) {
            timeoutId = window.setTimeout(loadWaveform, 250);
        }

        return () => {
            cancelled = true;
            if (timeoutId !== null) window.clearTimeout(timeoutId);
            if (idleId !== null && cancelIdle) cancelIdle(idleId);
        };
    }, [songId, streamUrl]);

    return waveform;
};
