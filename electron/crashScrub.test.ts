import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/electron/main';
import { scrubEvent, scrubText } from './crashScrub';

const winCtx = { homeDir: 'C:\\Users\\remvr' };
const macCtx = { homeDir: '/Users/alex' };

describe('scrubText', () => {
  it('removes Subsonic credentials and the server address from stream URLs', () => {
    const out = scrubText(
      'GET https://music.example.com:4533/rest/stream.view?u=alex&t=26719a1196d2a940705a59634eb18eab&s=c19b2d&v=1.16.1&c=nebula&id=42 failed',
      winCtx,
    );
    expect(out).toBe('GET https://<server> failed');
    expect(out).not.toMatch(/alex|26719a|c19b2d|example/);
  });

  it('removes plaintext and hex-encoded Subsonic passwords outside a URL', () => {
    expect(scrubText('query ?u=alex&p=hunter2&v=1', winCtx)).toBe('query ?u=<redacted>&p=<redacted>&v=1');
    expect(scrubText('password was enc:68756e74657232', winCtx)).toBe('password was enc:<redacted>');
  });

  it('removes userinfo-bearing and plain-http server URLs', () => {
    expect(scrubText('http://alex:secret@192.168.1.20:4040/rest/ping.view', winCtx)).toBe('http://<server>');
    expect(scrubText('ws://127.0.0.1:39123/bridge', winCtx)).toBe('ws://<server>');
  });

  it('keeps bundled app URLs so stack traces still map, minus any query', () => {
    expect(scrubText('at render (app://nebula/assets/index-abc123.js:12:345)', winCtx))
      .toBe('at render (app://nebula/assets/index-abc123.js:12:345)');
    expect(scrubText('app://nebula/proxy?u=https%3A%2F%2Fmusic.example.com%2Frest', winCtx))
      .toBe('app://nebula/proxy');
    expect(scrubText('at x (app:///electron/dist/main.cjs:1:2)', winCtx)).toBe('at x (app:///electron/dist/main.cjs:1:2)');
  });

  it('replaces the user home directory in Windows and macOS paths', () => {
    expect(scrubText(
      "ENOENT: no such file, open 'C:\\Users\\remvr\\AppData\\Roaming\\Nebula\\settings.json'",
      winCtx,
    )).toBe("ENOENT: no such file, open '~\\AppData\\Roaming\\Nebula\\settings.json'");
    expect(scrubText('at /Users/alex/Library/Application Support/Nebula/x.js:1:1', macCtx))
      .toBe('at ~/Library/Application Support/Nebula/x.js:1:1');
  });

  it('replaces other users\' home directories and file URLs too', () => {
    expect(scrubText('D:\\Users\\Someone Else\\Music\\a.flac', winCtx)).toBe('~\\Music\\a.flac');
    expect(scrubText('file:///C:/Users/remvr/Music/a.flac', winCtx)).toBe('file:///~/Music/a.flac');
    expect(scrubText('/home/pat/.config/nebula', winCtx)).toBe('~/.config/nebula');
  });

  it('removes API keys, bearer tokens and email addresses', () => {
    expect(scrubText('401 for key gsk_ABCdef0123456789xyzXYZ0123', winCtx)).toBe('401 for key <secret>');
    expect(scrubText('sk-proj-AbCdEf0123456789AbCdEf rejected', winCtx)).toBe('<secret> rejected');
    expect(scrubText('Authorization: Bearer eyJhbGciOi.abc-def_123', winCtx)).toBe('Authorization: Bearer <secret>');
    expect(scrubText('contact alex@example.com', winCtx)).toBe('contact <email>');
  });

  it('caps very long text', () => {
    expect(scrubText('x'.repeat(5000), winCtx, 100)).toHaveLength(101);
  });
});

describe('scrubEvent', () => {
  const baseEvent = (): ErrorEvent => ({
    type: undefined,
    event_id: 'abc',
    message: 'Failed https://music.example.com/rest/getSong.view?u=alex&p=pw',
    server_name: 'ALEX-DESKTOP',
    user: { id: '6b0b9a5e-2f2e-4a0c-9c43-0d0f7f1b0a11', ip_address: '203.0.113.9', username: 'alex', email: 'a@b.c' },
    request: { url: 'https://music.example.com', headers: { Cookie: 'x' } },
    breadcrumbs: [{ message: 'played Song Title' }],
    exception: {
      values: [{
        type: 'TypeError',
        value: "Cannot read 'x' at C:\\Users\\remvr\\file.txt",
        stacktrace: {
          frames: [{
            filename: 'C:\\Users\\remvr\\AppData\\Local\\Programs\\Nebula\\resources\\app.asar\\electron\\dist\\main.cjs',
            abs_path: 'C:\\Users\\remvr\\AppData\\Local\\Programs\\Nebula\\resources\\app.asar\\electron\\dist\\main.cjs',
            function: 'load',
            vars: { password: 'hunter2' },
            context_line: 'const pw = "hunter2"',
            pre_context: ['a'],
            post_context: ['b'],
          }],
        },
      }],
    },
    contexts: {
      os: { name: 'Windows', version: '10.0.26200' },
      app: { app_version: '3.0.2-beta.2', app_arch: 'x64', app_name: 'Nebula', app_memory: 123, device_app_hash: 'h' },
      runtime: { name: 'Electron', version: '44.7.0' },
      device: { family: 'Desktop', screen_resolution: '3840x2160', model: 'Surface' },
      culture: { locale: 'en-US', timezone: 'America/Chicago' },
      chrome: { name: 'Chrome', version: '146' },
      node: { name: 'Node', version: '24' },
    },
    tags: { 'event.process': 'browser', 'nebula.view': 'library', secretTag: 'https://music.example.com' },
    extra: { componentStack: 'at Settings (app://nebula/assets/x.js:1:1)', arbitrary: 'C:\\Users\\remvr' },
    modules: { react: '19' },
  });

  it('keeps only the random install id on the user', () => {
    const out = scrubEvent(baseEvent(), winCtx)!;
    expect(out.user).toEqual({ id: '6b0b9a5e-2f2e-4a0c-9c43-0d0f7f1b0a11' });
  });

  it('drops machine name, request data, breadcrumbs, modules and frame locals', () => {
    const out = scrubEvent(baseEvent(), winCtx)!;
    expect(out.server_name).toBeUndefined();
    expect(out.request).toBeUndefined();
    expect(out.breadcrumbs).toEqual([]);
    expect(out.modules).toBeUndefined();
    const frame = out.exception!.values![0]!.stacktrace!.frames![0]!;
    expect(frame.vars).toBeUndefined();
    expect(frame.context_line).toBeUndefined();
    expect(frame.pre_context).toBeUndefined();
    expect(frame.post_context).toBeUndefined();
  });

  it('scrubs the message, exception values and frame paths', () => {
    const out = scrubEvent(baseEvent(), winCtx)!;
    expect(out.message).toBe('Failed https://<server>');
    expect(out.exception!.values![0]!.value).toBe("Cannot read 'x' at ~\\file.txt");
    expect(out.exception!.values![0]!.stacktrace!.frames![0]!.filename)
      .toBe('~\\AppData\\Local\\Programs\\Nebula\\resources\\app.asar\\electron\\dist\\main.cjs');
  });

  it('keeps only allowlisted contexts, fields, tags and extras', () => {
    const out = scrubEvent(baseEvent(), winCtx)!;
    expect(Object.keys(out.contexts!).sort()).toEqual(['app', 'chrome', 'device', 'node', 'os', 'runtime']);
    expect(out.contexts!.app).toEqual({ app_version: '3.0.2-beta.2', app_arch: 'x64', app_name: 'Nebula' });
    expect(out.contexts!.device).toEqual({ family: 'Desktop' });
    expect(out.tags).toEqual({ 'event.process': 'browser', 'nebula.view': 'library' });
    expect(out.extra).toEqual({ componentStack: 'at Settings (app://nebula/assets/x.js:1:1)' });
  });

  it('scrubs structured logentry messages', () => {
    const event = baseEvent();
    event.logentry = { message: 'oops C:\\Users\\remvr\\a', params: ['alex@example.com'] };
    const out = scrubEvent(event, winCtx)!;
    expect(out.logentry).toEqual({ message: 'oops ~\\a' });
  });
});
