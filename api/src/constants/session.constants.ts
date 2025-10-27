export const SESSION_STATUS = {
    ACTIVE: 'active',
    IDLE: 'idle',
    EXPIRED: 'expired',
    TERMINATED: 'terminated',
} as const;

export const SESSION_TIMEOUTS = {
    IDLE_MINUTES: 15,
    MAX_DURATION_HOURS: 12,
} as const;

export const SESSION_HEADERS = {
    USER_ID: 'x-user-id',
    SESSION_ID: 'x-session-id',
} as const;
