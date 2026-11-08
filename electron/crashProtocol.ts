import * as z from '../lib/zod';

/** 'unset' means the user has not been asked yet; reporting is off until 'enabled'. */
export type CrashReportConsent = 'unset' | 'enabled' | 'disabled';

export interface CrashReportingState {
  /** False in builds without a crash-report DSN (local and fork builds, the web build). */
  available: boolean;
  consent: CrashReportConsent;
}

/** A renderer error forwarded over `nebula:diagnostics:report`. Sizes are capped before parsing. */
export const rendererErrorReportSchema = z.object({
  kind: z.enum(['boundary', 'view-boundary', 'window-error', 'unhandled-rejection']),
  name: z.optional(z.string().check(z.maxLength(200))),
  message: z.string().check(z.maxLength(4096)),
  stack: z.optional(z.string().check(z.maxLength(32 * 1024))),
  componentStack: z.optional(z.string().check(z.maxLength(32 * 1024))),
  view: z.optional(z.string().check(z.regex(/^[A-Za-z0-9_-]{1,40}$/))),
});

export type RendererErrorReport = z.infer<typeof rendererErrorReportSchema>;
