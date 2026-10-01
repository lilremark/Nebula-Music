/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrackWaveform } from './useTrackWaveform';

describe('waveform hook connection lifecycle', () => {
    let root: Root;
    const Probe = ({ id, url }: { id: string; url?: string }) => {
        useTrackWaveform(id, url);
        return null;
    };
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        root = createRoot(document.createElement('div'));
        localStorage.clear();
        vi.useFakeTimers();
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        vi.useRealTimers();
        vi.unstubAllGlobals();
        delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
    });

    it('shares one real fetch and aborts it only after the final mounted consumer leaves', async () => {
        let signal!: AbortSignal;
        const fetchMock = vi.fn((_url: string, options: RequestInit) => {
            signal = options.signal as AbortSignal;
            return new Promise((_resolve, reject) => {
                signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
            });
        });
        vi.stubGlobal('fetch', fetchMock);
        const url = 'https://music.example/stream?id=shared-lifecycle';
        await act(async () => root.render(<><Probe key="first" id="shared-lifecycle" url={url} /><Probe key="second" id="shared-lifecycle" url={url} /></>));
        await act(async () => vi.advanceTimersByTimeAsync(250));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await act(async () => root.render(<Probe key="second" id="shared-lifecycle" url={url} />));
        expect(signal.aborted).toBe(false);
        await act(async () => root.render(null));
        expect(signal.aborted).toBe(true);
    });

    it('releases each stale stream as tracks change and does not fetch when disabled', async () => {
        const signals: AbortSignal[] = [];
        const fetchMock = vi.fn((_url: string, options: RequestInit) => {
            const signal = options.signal as AbortSignal;
            signals.push(signal);
            return new Promise((_resolve, reject) => {
                signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
            });
        });
        vi.stubGlobal('fetch', fetchMock);
        for (let index = 0; index < 8; index += 1) {
            const id = `lifecycle-${index}`;
            await act(async () => root.render(<Probe id={id} url={`https://music.example/stream?id=${id}`} />));
            await act(async () => vi.advanceTimersByTimeAsync(250));
            expect(signals.filter(signal => !signal.aborted)).toHaveLength(1);
        }
        await act(async () => root.render(<Probe id="waveform-disabled" />));
        await act(async () => vi.advanceTimersByTimeAsync(2000));
        expect(signals.every(signal => signal.aborted)).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(8);
    });
});
