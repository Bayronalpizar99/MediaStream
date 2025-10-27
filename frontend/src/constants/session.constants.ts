export const SESSION_HEADERS = {
  USER_ID: 'x-user-id',
  SESSION_ID: 'x-session-id',
} as const;

export const SESSION_DEFAULTS = {
  HEARTBEAT_INTERVAL_MS: 2 * 60 * 1000,
} as const;
