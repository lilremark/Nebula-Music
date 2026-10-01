/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdaptiveColors } from './useAdaptiveColors';

describe('adaptive artwork colors', () => {
    let root: Root;
    let result: ReturnType<typeof useAdaptiveColors>;
    let images: Array<{ src: string; onload: () => void }>;
    let drawnImage: string;
    const Probe = ({ url }: { url?: string }) => { result = useAdaptiveColors(url); return null; };
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        root = createRoot(document.createElement('div'));
        images = [];
        vi.stubGlobal('Image', class {
            src = ''; crossOrigin = ''; onload = () => {}; onerror = () => {};
            constructor() { images.push(this); }
        });
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            drawImage: (img: { src: string }) => { drawnImage = img.src; },
            getImageData: () => ({ data: new Uint8ClampedArray(drawnImage.includes('new') ? [64, 192, 64, 255] : [192, 64, 64, 255]) }),
        } as any);
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        vi.restoreAllMocks(); vi.unstubAllGlobals();
        delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
    });

    it('keeps the latest palette when old artwork loads after a track switch', async () => {
        await act(async () => root.render(<Probe url="https://art.example/old-race" />));
        await act(async () => root.render(<Probe url="https://art.example/new-race" />));
        await act(async () => images[1].onload());
        const latest = result.colors;
        await act(async () => images[0].onload());
        expect(result.colors).toBe(latest);
        expect(result.isLoading).toBe(false);
    });

    it('restores cached colors after artwork is cleared and selected again', async () => {
        const url = 'https://art.example/new-cached';
        await act(async () => root.render(<Probe url={url} />));
        await act(async () => images[0].onload());
        const loaded = result.colors;
        await act(async () => root.render(<Probe />));
        expect(result.colors).toBe(result.defaultColors);
        await act(async () => root.render(<Probe url={url} />));
        expect(result.colors).toBe(loaded);
        expect(images).toHaveLength(1);
    });

    it('returns a settled fallback if a cross-origin image taints the canvas', async () => {
        vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({
            drawImage: () => {},
            getImageData: () => { throw new DOMException('Tainted canvas', 'SecurityError'); },
        } as any);
        await act(async () => root.render(<Probe url="https://art.example/tainted" />));
        await act(async () => images[0].onload());
        expect(result.colors).toBe(result.defaultColors);
        expect(result.isLoading).toBe(false);
    });
});
