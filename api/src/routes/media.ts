import { Router } from 'express';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import {
    AUDIO_MIME_TYPES,
    AUDIO_UPLOAD_LIMIT_BYTES,
    isAudioExtensionSupported,
    type AudioExtension
} from '../constants/index.js';
import { authenticateUser } from '../security/index.js';
import {
    audioLibraryPath,
    isSupportedAudioFile,
    ensureAudioLibrary
} from '../config/media.js';

type AudioFileSummary = {
    name: string;
    size: number;
    format: string;
    mimeType: string;
    url: string;
};

type UploadedFile = {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
};

const sanitizeBaseName = (baseName: string): string => {
    const trimmed = baseName.trim().replace(/\s+/g, ' ');
    const sanitized = trimmed.replace(/[^a-zA-Z0-9\-_. ]/g, '_').replace(/\.+$/, '');
    return sanitized.length > 0 ? sanitized : 'audio';
};

const fileExists = async (filePath: string): Promise<boolean> => {
    try {
        await fsPromises.access(filePath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
};

const generateUniqueFileName = async (baseName: string, extension: AudioExtension): Promise<string> => {
    const safeBase = sanitizeBaseName(baseName);
    let counter = 0;
    let candidate = `${safeBase}${extension}`;

    while (await fileExists(path.join(audioLibraryPath, candidate))) {
        counter += 1;
        candidate = `${safeBase} (${counter})${extension}`;
    }

    return candidate;
};

ensureAudioLibrary();
const normalizedLibraryRoot = path.resolve(audioLibraryPath);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: AUDIO_UPLOAD_LIMIT_BYTES,
        files: 1,
    },
});

const MIME_TO_EXTENSION: Record<string, AudioExtension> = Object.entries(AUDIO_MIME_TYPES).reduce(
    (acc, [extension, mime]) => {
        acc[mime] = extension as AudioExtension;
        return acc;
    },
    {} as Record<string, AudioExtension>
);

const buildAudioResponseItem = async (fileName: string): Promise<AudioFileSummary | null> => {
    const resolvedPath = path.join(audioLibraryPath, fileName);
    try {
        const stats = await fsPromises.stat(resolvedPath);
        if (!stats.isFile()) {
            return null;
        }

        const extension = path.extname(fileName).toLowerCase();
        if (!isAudioExtensionSupported(extension)) {
            return null;
        }

        const normalizedExtension = extension as AudioExtension;

        return {
            name: fileName,
            size: stats.size,
            format: normalizedExtension.slice(1),
            mimeType: AUDIO_MIME_TYPES[normalizedExtension] ?? 'application/octet-stream',
            url: `/media/audio/${encodeURIComponent(fileName)}`,
        };
    } catch (error) {
        console.error(`Failed to build audio summary for ${fileName}:`, error);
        return null;
    }
};

export const mediaRouter = Router();

const resolveExtension = (file: UploadedFile): AudioExtension | null => {
    const originalExt = path.extname(file.originalname || '').toLowerCase();
    if (isAudioExtensionSupported(originalExt)) {
        return originalExt as AudioExtension;
    }

    const normalizedMime = (file.mimetype || '').toLowerCase();
    return MIME_TO_EXTENSION[normalizedMime] ?? null;
};

const singleFileUpload = upload.single('file');

mediaRouter.post(
    '/audio',
    authenticateUser,
    (req, res, next) => {
        singleFileUpload(req, res, (err: unknown) => {
            if (!err) {
                return next();
            }

            const uploadError = err as { code?: string; message?: string };

            if (uploadError?.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ message: 'El archivo excede el tamaño máximo permitido.' });
            }

            if (uploadError?.code) {
                return res.status(400).json({ message: uploadError.message ?? 'No se pudo subir el archivo.' });
            }

            console.error('Upload middleware error:', err);
            return res.status(500).json({ message: 'No se pudo recibir el archivo de audio.' });
        });
    },
    async (req, res) => {
        try {
            const { file } = req as unknown as { file?: UploadedFile };
            if (!file) {
                return res.status(400).json({ message: 'Se requiere un archivo de audio.' });
            }

            if (!file.buffer || file.buffer.length === 0) {
                return res.status(400).json({ message: 'El archivo de audio está vacío.' });
            }

            const extension = resolveExtension(file);
            if (!extension) {
                return res.status(415).json({ message: 'Formato de audio no soportado.' });
            }

            const originalExt = path.extname(file.originalname || '').toLowerCase();
            const baseCandidate = originalExt
                ? path.basename(file.originalname, originalExt)
                : file.originalname;
            const baseName = sanitizeBaseName(baseCandidate || 'audio');

            const uniqueFileName = await generateUniqueFileName(baseName, extension);
            const targetPath = path.join(audioLibraryPath, uniqueFileName);
            const normalizedTargetPath = path.resolve(targetPath);

            if (!normalizedTargetPath.startsWith(normalizedLibraryRoot)) {
                return res.status(403).json({ message: 'No se puede almacenar el archivo en la ruta solicitada.' });
            }

            await fsPromises.writeFile(normalizedTargetPath, file.buffer);
            const summary = await buildAudioResponseItem(uniqueFileName);

            if (!summary) {
                return res.status(500).json({ message: 'No se pudo procesar el archivo de audio.' });
            }

            res.status(201).json({
                message: 'Archivo de audio subido correctamente.',
                item: summary,
            });
        } catch (error) {
            console.error('Failed to upload audio file:', error);
            res.status(500).json({
                message: 'No se pudo subir el archivo de audio.',
            });
        }
    }
);

mediaRouter.get('/audio', authenticateUser, async (_req, res) => {
    try {
        const entries = await fsPromises.readdir(audioLibraryPath, { withFileTypes: true });
        const files = await Promise.all(
            entries
                .filter(entry => entry.isFile() && isSupportedAudioFile(entry.name))
                .map(entry => buildAudioResponseItem(entry.name))
        );

        const items = files.filter((file): file is AudioFileSummary => Boolean(file));

        res.json({
            message: 'Audio files retrieved successfully',
            items,
        });
    } catch (error) {
        console.error('Failed to list audio files:', error);
        res.status(500).json({
            message: 'Unable to list audio files',
        });
    }
});

mediaRouter.get('/audio/:fileName', authenticateUser, async (req, res) => {
    try {
        const { fileName } = req.params;
        if (!fileName) {
            return res.status(400).json({ message: 'Filename is required' });
        }

        const sanitizedFileName = path.basename(fileName);
        if (!isSupportedAudioFile(sanitizedFileName)) {
            return res.status(400).json({ message: 'Unsupported audio format' });
        }

        const resolvedPath = path.join(audioLibraryPath, sanitizedFileName);
        const normalizedPath = path.resolve(resolvedPath);
        if (!normalizedPath.startsWith(normalizedLibraryRoot)) {
            return res.status(403).json({ message: 'Access to the requested file is denied' });
        }

        if (!fs.existsSync(normalizedPath)) {
            return res.status(404).json({ message: 'Audio file not found' });
        }

        const stat = await fsPromises.stat(normalizedPath);
        if (!stat.isFile()) {
            return res.status(404).json({ message: 'Audio file not found' });
        }

        const fileSize = stat.size;
        const extension = path.extname(normalizedPath).toLowerCase();
        const normalizedExtension = isAudioExtensionSupported(extension)
            ? (extension as AudioExtension)
            : null;
        const mimeType = normalizedExtension
            ? AUDIO_MIME_TYPES[normalizedExtension]
            : 'application/octet-stream';
        const rangeHeader = req.headers.range;

        if (rangeHeader) {
            const byteRange = rangeHeader.replace(/bytes=/, '').split('-');
            const start = parseInt(byteRange[0] ?? '0', 10);
            const end = byteRange[1] ? parseInt(byteRange[1], 10) : fileSize - 1;

            if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || end >= fileSize) {
                return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
            }

            const chunkSize = (end - start) + 1;
            const stream = fs.createReadStream(normalizedPath, { start, end });

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': mimeType,
            });
            stream.pipe(res);
            stream.on('error', (error) => {
                console.error('Stream error:', error);
                res.destroy(error);
            });
            return;
        }

        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': mimeType,
            'Accept-Ranges': 'bytes',
        });

        const stream = fs.createReadStream(normalizedPath);
        stream.pipe(res);
        stream.on('error', (error) => {
            console.error('Stream error:', error);
            res.destroy(error);
        });
    } catch (error) {
        console.error('Failed to stream audio file:', error);
        res.status(500).json({
            message: 'Unable to stream audio file',
        });
    }
});
