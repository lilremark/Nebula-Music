/**
 * The slice of the Sentry Electron SDK that crash reporting uses, bundled on
 * its own as `electron/dist/sentryMain.cjs`. The main bundle loads it only
 * after the user opts in, so launches without consent never parse the SDK
 * (it is roughly twice the size of the rest of the main process).
 */
export {
  captureException,
  captureMessage,
  dedupeIntegration,
  electronContextIntegration,
  eventFiltersIntegration,
  functionToStringIntegration,
  init,
  linkedErrorsIntegration,
  makeElectronTransport,
  normalizePathsIntegration,
  onUncaughtExceptionIntegration,
  onUnhandledRejectionIntegration,
  setUser,
} from '@sentry/electron/main';
