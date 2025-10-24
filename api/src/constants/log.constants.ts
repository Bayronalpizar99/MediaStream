export const LOG_FORMATS = {
  PRODUCTION: 'combined',
  DEVELOPMENT: 'dev',
  COMMON: 'common',
  SHORT: 'short',
  TINY: 'tiny',
} as const;

export type LogFormat = typeof LOG_FORMATS[keyof typeof LOG_FORMATS];
