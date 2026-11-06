/**
 * The app's single zod entry point: the tree-shakeable `zod/mini` API with
 * English error messages. Classic `zod` cannot be tree-shaken and adds ~430 KB
 * to the main-process bundle and to the renderer chunk the mini-player loads.
 * Import as `import * as z from '../lib/zod'` so unused validators drop out.
 */
import { config } from 'zod/mini';
import { en } from 'zod/locales';

config(en());

export * from 'zod/mini';
