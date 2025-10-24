// Local Storage Keys
export const STORAGE_KEYS = {
  SESSION: 'mediastream_session',
  USER_PREFERENCES: 'mediastream_preferences',
  THEME: 'mediastream_theme',
} as const;

// Session Configuration
export const SESSION_CONFIG = {
  EXPIRY_HOURS: 24,
  REFRESH_THRESHOLD_HOURS: 2,
} as const;

// App Configuration
export const APP_CONFIG = {
  NAME: 'MediaStream',
  VERSION: '1.0.0',
  DESCRIPTION: 'Sistema Multimedia Distribuido',
} as const;