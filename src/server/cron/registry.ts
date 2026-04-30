import 'server-only';
import type { CronJob } from './types';

// Downstream feature changes append exactly one entry here each.
export const cronRegistry: CronJob[] = [];
