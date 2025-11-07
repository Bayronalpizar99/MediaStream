export const AUDIO_FORMATS = ['mp3', 'wav', 'flac', 'aac', 'ogg'] as const;

export type AudioFormat = typeof AUDIO_FORMATS[number];

export const AUDIO_MIME_TYPES: Record<AudioFormat, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
};

export const AUDIO_CONVERSION_DEFAULTS = {
  BITRATE_KBPS: 192,
  QUALITY: 2,
} as const;

export const AUDIO_CONVERSION_LIMITS = {
  MIN_BITRATE_KBPS: 64,
  MAX_BITRATE_KBPS: 320,
  MIN_QUALITY: 0,
  MAX_QUALITY: 9,
} as const;
