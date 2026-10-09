import { useEffect, useState } from 'react';
import { createTrackWaveformLoader, type TrackWaveformSubscription } from './trackWaveformLoader';

import { buildWaveformPeaks, WAVEFORM_SAMPLES } from './waveformPeaks';

const STORAGE_PREFIX = 'nebula_waveform_v5:';
const MAX_MEMORY_ENTRIES = 128;

interface WaveformCacheEntry {
    version: 5;
    peaks: number[];
    updatedAt: number;
}

const memoryCache = new Map<string, number[]>();

const rememberWaveform = (cacheKey: string, peaks: number[]) => {
    memoryCache.delete(cacheKey);
    memoryCache.set(cacheKey, peaks);
    if (memoryCache.size > MAX_MEMORY_ENTRIES) memoryCache.delete(memoryCache.keys().next().value!);
};

const normalizePeaks = (peaks: number[]) => peaks.map(peak => Math.min(1, Math.max(0, peak)));

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
        if (parsed?.version !== 5 || !Array.isArray(parsed.peaks) || parsed.peaks.length !== WAVEFORM_SAMPLES
            || parsed.peaks.some(peak => !Number.isFinite(peak) || peak < 0)) return null;
        const peaks = normalizePeaks(parsed.peaks);
        rememberWaveform(cacheKey, peaks);
        return peaks;
    } catch {
        return null;
    }
};

const writeCachedWaveform = (cacheKey: string, peaks: number[]) => {
    const normalized = normalizePeaks(peaks);
    rememberWaveform(cacheKey, normalized);
    try {
        const payload: WaveformCacheEntry = {
            version: 5,
            peaks: normalized,
            updatedAt: Date.now(),
        };
        localStorage.setItem(`${STORAGE_PREFIX}${cacheKey}`, JSON.stringify(payload));
    } catch {
        // Ignore storage limits/errors and keep in-memory cache.
    }
};

const decodeWaveform = async (streamUrl: string, signal: AbortSignal) => {
    const response = await fetch(streamUrl, { cache: 'force-cache', signal });
    if (!response.ok) throw new Error(`Waveform fetch failed: ${response.status}`);

    const audioData = await response.arrayBuffer();
    signal.throwIfAborted();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio API not available');

    const audioContext = new AudioContextClass();
    try {
        const decoded = await audioContext.decodeAudioData(audioData);
        signal.throwIfAborted();
        return buildWaveformPeaks(Array.from({ length: decoded.numberOfChannels }, (_, channel) => decoded.getChannelData(channel)));
    } finally {
        audioContext.close().catch(() => undefined);
    }
};

const waveformLoader = createTrackWaveformLoader(decodeWaveform);

export const useTrackWaveform = (songId?: string, streamUrl?: string | null) => {
    const [waveform, setWaveform] = useState<number[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        let timeoutId: number | null = null;
        let idleId: number | null = null;
        let subscription: TrackWaveformSubscription<number[]> | null = null;

        if (!songId || !streamUrl) {
            setWaveform(null);
            return () => {
                cancelled = true;
            };
        }

        const cacheKey = getWaveformCacheKey(songId, streamUrl);
        const cached = memoryCache.get(cacheKey) || readCachedWaveform(cacheKey);
        if (cached) {
            setWaveform(cached);
        } else {
            setWaveform(null);
        }

        const loadWaveform = () => {
            if (cancelled) return;
            subscription = waveformLoader.subscribe(cacheKey, streamUrl);
            subscription.promise
                .then((peaks) => {
                    writeCachedWaveform(cacheKey, peaks);
                    return peaks;
                })
                .catch((error) => {
                    if (!(error instanceof Error && error.name === 'AbortError')) {
                        console.warn('Waveform unavailable, showing playback progress', error);
                    }
                    return null;
                })
                .then((peaks) => {
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
            subscription?.release();
        };
    }, [songId, streamUrl]);

    return waveform;
};
