import type { ErrorEvent, StackFrame } from '@sentry/electron/main';

/**
 * Removes personal data from crash reports before they leave the machine.
 * Runs as Sentry's `beforeSend`, so it is the last thing to touch an event.
 * Sentry's server-side scrubbers are a second layer, never the only one.
 *
 * Text rules, in order: home-directory paths, URLs (only bundled `app://` and
 * `file://` URLs keep their path), Subsonic auth parameters, API keys, emails.
 * Event rules: allowlists for contexts, tags and extras; the user keeps only
 * the random install id; breadcrumbs, request data, frame locals and source
 * lines are dropped.
 */

export interface ScrubContext {
  /** The current user's home directory, from `os.homedir()`. */
  homeDir: string;
}

const MAX_TEXT = 1024;
const MAX_STACK_TEXT = 16 * 1024;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// `C:\Users\name`, `C:/Users/name`, `/Users/name`, `/home/name`. The user
// segment may contain spaces, so it runs to the next separator.
const HOME_PATH = /(?:[A-Za-z]:)?([\\/])(?:Users|home)\1[^\\/\r\n'"`]+/gi;
const URL_PATTERN = /\b([a-z][a-z0-9+.-]*):\/\/[^\s'"`<>()[\]{}]*/gi;
const AUTH_PARAM = /([?&])(u|p|t|s|apiKey|api_key|token|password|access_token)=[^&\s'"`]*/gi;
const SUBSONIC_ENC = /\benc:[0-9a-f]+/gi;
const API_KEY = /\b(?:gsk_|sk-|sk_|xai-|AIza|ghp_|github_pat_)[A-Za-z0-9_-]{8,}/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const scrubUrl = (match: string, scheme: string): string => {
  const lower = scheme.toLowerCase();
  if (lower === 'app' || lower === 'file') return match.replace(/[?#].*$/, '');
  return `${lower}://<server>`;
};

export const scrubText = (text: string, ctx: ScrubContext, max = MAX_TEXT): string => {
  let out = text;
  if (ctx.homeDir.length > 1) {
    const variants = new Set([ctx.homeDir, ctx.homeDir.replace(/\\/g, '/')]);
    for (const variant of variants) out = out.replace(new RegExp(escapeRegExp(variant), 'gi'), '~');
  }
  out = out
    .replace(HOME_PATH, '~')
    .replace(URL_PATTERN, scrubUrl)
    .replace(AUTH_PARAM, '$1$2=<redacted>')
    .replace(SUBSONIC_ENC, 'enc:<redacted>')
    .replace(API_KEY, '<secret>')
    .replace(BEARER, 'Bearer <secret>')
    .replace(EMAIL, '<email>');
  return out.length > max ? `${out.slice(0, max)}…` : out;
};

const pick = (source: unknown, keys: readonly string[]): Record<string, unknown> | undefined => {
  if (!source || typeof source !== 'object') return undefined;
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const value = (source as Record<string, unknown>)[key];
    if (value !== undefined) result[key] = value;
  }
  return Object.keys(result).length ? result : undefined;
};

const CONTEXT_FIELDS: Record<string, readonly string[]> = {
  os: ['name', 'version', 'build', 'kernel_version'],
  app: ['app_version', 'app_arch', 'app_name', 'build_type'],
  runtime: ['name', 'version'],
  chrome: ['name', 'version', 'type'],
  node: ['name', 'version', 'type'],
  device: ['family'],
};

const TAG_KEYS = new Set(['event.process', 'event.origin', 'event.environment']);
const EXTRA_KEYS = new Set(['componentStack', 'exitCode', 'reason', 'processType']);

const scrubFrame = (frame: StackFrame, ctx: ScrubContext): StackFrame => {
  const { vars: _vars, context_line: _line, pre_context: _pre, post_context: _post, ...rest } = frame;
  const out: StackFrame = { ...rest };
  if (out.filename) out.filename = scrubText(out.filename, ctx);
  if (out.abs_path) out.abs_path = scrubText(out.abs_path, ctx);
  if (out.module) out.module = scrubText(out.module, ctx);
  return out;
};

export const scrubEvent = (event: ErrorEvent, ctx: ScrubContext): ErrorEvent => {
  const {
    server_name: _server,
    request: _request,
    modules: _modules,
    threads: _threads,
    user,
    contexts,
    tags,
    extra,
    logentry,
    ...rest
  } = event;
  const out: ErrorEvent = { ...rest, breadcrumbs: [] };

  if (typeof user?.id === 'string') out.user = { id: user.id };
  if (out.message) out.message = scrubText(out.message, ctx);
  if (out.transaction) out.transaction = scrubText(out.transaction, ctx);
  if (logentry?.message) out.logentry = { message: scrubText(logentry.message, ctx) };

  if (out.exception?.values) {
    out.exception = {
      values: out.exception.values.map((value) => ({
        ...value,
        value: value.value === undefined ? undefined : scrubText(value.value, ctx),
        mechanism: value.mechanism ? { type: value.mechanism.type, handled: value.mechanism.handled } : undefined,
        stacktrace: value.stacktrace?.frames
          ? { frames: value.stacktrace.frames.map((frame) => scrubFrame(frame, ctx)) }
          : value.stacktrace,
      })),
    };
  }

  if (contexts) {
    const kept: NonNullable<ErrorEvent['contexts']> = {};
    for (const [name, fields] of Object.entries(CONTEXT_FIELDS)) {
      const picked = pick(contexts[name], fields);
      if (picked) kept[name] = picked;
    }
    out.contexts = kept;
  }

  if (tags) {
    const kept: Record<string, string> = {};
    for (const [key, value] of Object.entries(tags)) {
      if ((TAG_KEYS.has(key) || key.startsWith('nebula.')) && value !== undefined && value !== null) {
        kept[key] = scrubText(String(value), ctx, 200);
      }
    }
    out.tags = kept;
  }

  if (extra) {
    const kept: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(extra)) {
      if (!EXTRA_KEYS.has(key)) continue;
      kept[key] = typeof value === 'string' ? scrubText(value, ctx, MAX_STACK_TEXT) : value;
    }
    out.extra = kept;
  }

  return out;
};
