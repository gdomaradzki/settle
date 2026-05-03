import 'server-only';

/**
 * Stable id for the System user — the actor attributed to every BillEvent
 * written by a cron job. This is a known constant (not a generated cuid) so
 * that it can be grepped, hard-coded in seed data, and never changes across
 * re-seeds.
 */
export const SYSTEM_USER_ID = 'system';
