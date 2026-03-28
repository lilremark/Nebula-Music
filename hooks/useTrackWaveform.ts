import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'nebula_waveform_v2:';
const WAVEFORM_SAMPLES = 180;

interface WaveformCacheEntry {
    version: 2;
    peaks: number[];
    updatedAt: number;
}

const memoryCache = new Map<string, number[]>();
const inFlight = new Map<string, Promise<number[]>>();

const FALLBACK_WAVEFORM = Array.from({ length: WAVEFORM_SAMPLES }, (_, i) => {
    const phase = i / WAVEFORM_SAMPLES;
    const wave = Math.abs(Math.sin(phase * Math.PI * 5));
    return 0.25 + wave * 0.6;
});

const normalizePeaks = (peaks: number[]) => {
    if (!peaks.length) return [...FALLBACK_WAVEFORM];
    const maxPeak = Math.max(...peaks, 0.001);
    return peaks.map((peak) => Math.min(1, Math.max(0.05, peak / maxPeak)));
};

const readCachedWaveform = (songId: string): number[] | null => {
    try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${songId}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as WaveformCacheEntry;
        if (parsed?.version !== 2 || !Array.isArray(parsed.peaks)) return null;
        const peaks = normalizePeaks(parsed.peaks);
        memoryCache.set(songId, peaks);
        return peaks;
    } catch {
        return null;
    }
};

const writeCachedWaveform = (songId: string, peaks: number[]) => {
    const normalized = normalizePeaks(peaks);
    memoryCache.set(songId, normalized);
    try {
        const payload: WaveformCacheEntry = {
            version: 2,
            peaks: normalized,
            updatedAt: Date.now(),
        };
        localStorage.setItem(`${STORAGE_PREFIX}${songId}`, JSON.stringify(payload));
    } catch {
        // Ignore storage limits/errors and keep in-memory cache.
    }
};

const buildWaveformFromBuffer = (audioBuffer: AudioBuffer) => {
    const blockSize = Math.max(1, Math.floor(audioBuffer.length / WAVEFORM_SAMPLES));
    const peaks: number[] = [];

    for (let i = 0; i < WAVEFORM_SAMPLES; i += 1) {
        const start = i * blockSize;
        const end = Math.min(audioBuffer.length, start + blockSize);
        let peak = 0;

        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let j = start; j < end; j += 1) {
                const sample = Math.abs(channelData[j] || 0);
                if (sample > peak) peak = sample;
            }
        }

        peaks.push(peak);
    }

    return normalizePeaks(peaks);
};

const decodeWaveform = async (streamUrl: string) => {
    const response = await fetch(streamUrl);
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

const getOrCreateWaveform = async (songId: string, streamUrl: string) => {
    if (memoryCache.has(songId)) return memoryCache.get(songId)!;

    const cached = readCachedWaveform(songId);
    if (cached) return cached;

    if (inFlight.has(songId)) return inFlight.get(songId)!;

    const promise = decodeWaveform(streamUrl)
        .catch(() => [...FALLBACK_WAVEFORM])
        .then((peaks) => {
            writeCachedWaveform(songId, peaks);
            return peaks;
        })
        .finally(() => {
            inFlight.delete(songId);
        });

    inFlight.set(songId, promise);
    return promise;
};

export const useTrackWaveform = (songId?: string, streamUrl?: string | null) => {
    const [waveform, setWaveform] = useState<number[] | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (!songId || !streamUrl) {
            setWaveform(null);
            return () => {
                cancelled = true;
            };
        }

        const cached = memoryCache.get(songId) || readCachedWaveform(songId);
        if (cached) setWaveform(cached);

        getOrCreateWaveform(songId, streamUrl).then((peaks) => {
            if (!cancelled) setWaveform(peaks);
        });

        return () => {
            cancelled = true;
        };
    }, [songId, streamUrl]);

    return waveform;
};
