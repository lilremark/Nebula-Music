/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isInsecureHttpUrl, useInsecureHttpSetting } from './useInsecureHttpSetting';

const mock = vi.hoisted(() => ({ platform: null as any }));
vi.mock('../platform/PlatformContext', () => ({ usePlatform: () => mock.platform }));

describe('desktop HTTP consent', () => {
    let root: Root;
    let container: HTMLDivElement;
    let state: ReturnType<typeof useInsecureHttpSetting>;
    const Probe = () => { state = useInsecureHttpSetting(); return null; };
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        root = createRoot(container);
        mock.platform = { info: { kind: 'desktop' }, settings: { get: vi.fn(async () => false), set: vi.fn(async () => undefined) } };
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
    });

    it('blocks HTTP until explicit permission has been saved and permits HTTPS', async () => {
        await act(async () => root.render(<Probe />));
        expect(state.canConnect('http://music.example')).toBe(false);
        expect(state.canConnect('https://music.example')).toBe(true);
        await act(async () => state.change(true));
        expect(mock.platform.settings.set).toHaveBeenCalledWith('permitInsecureHttp', true);
        expect(state.canConnect('http://music.example')).toBe(true);
        await act(async () => state.change(false));
        expect(state.canConnect('http://music.example')).toBe(false);
    });

    it('preserves existing consent and does not claim a failed write enabled HTTP', async () => {
        mock.platform.settings.get.mockResolvedValue(true);
        await act(async () => root.render(<Probe />));
        expect(state.allowed).toBe(true);
        await act(async () => state.change(false));
        mock.platform.settings.set.mockRejectedValue(new Error('disk unavailable'));
        await act(async () => state.change(true));
        expect(state.allowed).toBe(false);
        expect(state.error).toContain('Could not save');
    });

    it('blocks HTTP while host initialization is pending, then allows the web host', async () => {
        mock.platform = null;
        await act(async () => root.render(<Probe />));
        expect(state.canConnect('http://music.example')).toBe(false);
        mock.platform = { info: { kind: 'web' } };
        await act(async () => root.render(<Probe />));
        expect(state.canConnect('http://music.example')).toBe(true);
    });

    it('recognizes URL schemes without treating malformed text as HTTP', () => {
        expect(isInsecureHttpUrl(' HTTP://music.example/path ')).toBe(true);
        expect(isInsecureHttpUrl('music.example')).toBe(false);
    });
});
