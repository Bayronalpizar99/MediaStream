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

export const VIDEO_FORMATS = ['mp4', 'avi', 'mkv'] as const;

export type VideoFormat = typeof VIDEO_FORMATS[number];

export const VIDEO_MIME_TYPES: Record<VideoFormat, string> = {
  mp4: 'video/mp4',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
};

export const VIDEO_CONVERSION_DEFAULTS = {
  BITRATE_KBPS: 2500,
  MAX_WIDTH: 1280,
} as const;

export const VIDEO_CONVERSION_LIMITS = {
  MIN_BITRATE_KBPS: 500,
  MAX_BITRATE_KBPS: 8000,
  MIN_WIDTH: 320,
  MAX_WIDTH: 3840,
} as const;
