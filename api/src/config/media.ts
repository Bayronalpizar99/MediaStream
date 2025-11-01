import fs from 'node:fs';
import path from 'node:path';
import {
    ENV_VARIABLES,
    DEFAULT_AUDIO_LIBRARY,
    isAudioExtensionSupported
} from '../constants/index.js';

const resolveAudioLibraryPath = (): string => {
    const configuredPath = process.env[ENV_VARIABLES.AUDIO_LIBRARY_PATH];
    if (!configuredPath) {
        return DEFAULT_AUDIO_LIBRARY;
    }

    const normalizedPath = path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(process.cwd(), configuredPath);

    return normalizedPath;
};

export const audioLibraryPath = resolveAudioLibraryPath();

export const ensureAudioLibrary = () => {
    if (!fs.existsSync(audioLibraryPath)) {
        fs.mkdirSync(audioLibraryPath, { recursive: true });
    }
};

export const isSupportedAudioFile = (filePath: string): boolean => {
    const extension = path.extname(filePath).toLowerCase();
    return isAudioExtensionSupported(extension);
};

ensureAudioLibrary();
