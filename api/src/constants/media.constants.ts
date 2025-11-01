import path from 'node:path';

export const AUDIO_FORMATS = {
    MP3: '.mp3',
    FLAC: '.flac',
    WAV: '.wav',
} as const;

export type AudioExtension = typeof AUDIO_FORMATS[keyof typeof AUDIO_FORMATS];

export const SUPPORTED_AUDIO_EXTENSIONS = Object.values(AUDIO_FORMATS) as AudioExtension[];

export const AUDIO_MIME_TYPES: Record<AudioExtension, string> = {
    [AUDIO_FORMATS.MP3]: 'audio/mpeg',
    [AUDIO_FORMATS.FLAC]: 'audio/flac',
    [AUDIO_FORMATS.WAV]: 'audio/wav',
};

export const DEFAULT_AUDIO_LIBRARY = path.resolve(process.cwd(), 'media', 'audio');

export const AUDIO_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024; // 100 MB

export const isAudioExtensionSupported = (extension: string): extension is AudioExtension => {
    return SUPPORTED_AUDIO_EXTENSIONS.includes(extension as AudioExtension);
};
