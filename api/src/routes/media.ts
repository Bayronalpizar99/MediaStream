import { Router } from 'express';
import { Readable } from 'node:stream';
import { createReadStream, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ReadableStream as NodeReadableStream } from 'stream/web';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid'; 
import admin from 'firebase-admin';
import { authenticateUser, requireAdmin } from '../security';
import dbConfig from '../config';
import { 
    COLLECTIONS_NAMES, 
    HttpErrorStatusCodes, 
    HttpSuccessStatusCodes, 
    USER_ROLES,
    AUDIO_FORMATS,
    AUDIO_CONVERSION_LIMITS,
    VIDEO_FORMATS,
    VIDEO_CONVERSION_LIMITS,
    LOCAL_MEDIA_CONFIG
} from '../constants';
import { MediaFile } from '../models/MediaModel'; 
import type { AudioFormat, VideoFormat } from '../constants';
import { callNodeService, NodeUnavailableError, openNodeStream } from '../services/nodeClient';
import { localMediaService, LocalMediaError } from '../services/localMedia.service';
import { convertLocalAudio, convertLocalVideo } from '../services/localConversion.service';

export const mediaRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, 
});

const localStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const ownerSegment = req.user?.id ?? 'shared';
    const destination = path.join(
      LOCAL_MEDIA_CONFIG.BASE_DIR,
      'uploads',
      ownerSegment,
    );
    try {
      mkdirSync(destination, { recursive: true });
      cb(null, destination);
    } catch (error) {
      cb(error as Error, destination);
    }
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const localUpload = multer({
  storage: localStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, 
});


mediaRouter.use(authenticateUser);

mediaRouter.get('/local', async (_req, res) => {
  try {
    const files = await localMediaService.list();
    return res.status(HttpSuccessStatusCodes.OK).send(files);
  } catch (error) {
    console.error('Error listing local media files:', error);
    return res
      .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
      .send({ message: 'No se pudieron obtener los archivos locales.' });
  }
});

mediaRouter.post('/local/upload', localUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(HttpErrorStatusCodes.BAD_REQUEST)
        .send({ message: 'Debes seleccionar un archivo local.' });
    }

    const record = await localMediaService.create({
      filePath: req.file.path,
      displayName: req.file.originalname,
      ownerId: req.user?.id,
      ownerUsername: req.user?.username,
    });

    return res.status(HttpSuccessStatusCodes.CREATED).send(record);
  } catch (error) {
    console.error('Error uploading local media file:', error);
    const status =
      error instanceof LocalMediaError
        ? error.statusCode
        : HttpErrorStatusCodes.INTERNAL_SERVER_ERROR;
    const message =
      error instanceof Error ? error.message : 'No se pudo registrar el archivo local.';
    return res.status(status).send({ message });
  }
});

mediaRouter.post('/local', async (req, res) => {
  try {
    const { path: filePath, name } = req.body ?? {};
    if (!filePath || typeof filePath !== 'string') {
      return res
        .status(HttpErrorStatusCodes.BAD_REQUEST)
        .send({ message: 'Debes proporcionar la ruta del archivo local.' });
    }

    const record = await localMediaService.create({
      filePath,
      displayName: typeof name === 'string' && name.trim().length > 0 ? name.trim() : undefined,
      ownerId: req.user?.id,
      ownerUsername: req.user?.username,
    });

    return res.status(HttpSuccessStatusCodes.CREATED).send(record);
  } catch (error) {
    console.error('Error registering local media file:', error);
    const status =
      error instanceof LocalMediaError
        ? error.statusCode
        : HttpErrorStatusCodes.INTERNAL_SERVER_ERROR;
    const message =
      error instanceof Error ? error.message : 'No se pudo registrar el archivo local.';
    return res.status(status).send({ message });
  }
});

mediaRouter.delete('/local/:localId', async (req, res) => {
  try {
    const { localId } = req.params;
    const record = await localMediaService.getById(localId);

    if (!record) {
      return res.status(HttpErrorStatusCodes.NOT_FOUND).send({ message: 'Archivo local no encontrado.' });
    }

    const isOwner = record.ownerId && record.ownerId === req.user?.id;
    const isAdmin = req.user?.role === USER_ROLES.ADMIN;

    if (!isAdmin && !isOwner) {
      return res.status(HttpErrorStatusCodes.FORBIDDEN).send({ message: 'No tienes permisos para eliminar este archivo.' });
    }

    const removed = await localMediaService.remove(localId);

    if (!removed) {
      return res
        .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
        .send({ message: 'No se pudo eliminar el archivo local.' });
    }

    return res.status(HttpSuccessStatusCodes.OK).send({ message: 'Archivo local eliminado correctamente.' });
  } catch (error) {
    console.error('Error deleting local media file:', error);
    return res
      .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
      .send({ message: 'Error al eliminar el archivo local.' });
  }
});

mediaRouter.get('/local/:localId/stream', async (req, res) => {
  try {
    const { localId } = req.params;
    const record = await localMediaService.getById(localId);

    if (!record) {
      return res.status(HttpErrorStatusCodes.NOT_FOUND).send({ message: 'Archivo local no encontrado.' });
    }

    if (!record.available) {
      return res.status(HttpErrorStatusCodes.NOT_FOUND).send({ message: 'El archivo local ya no está disponible en el sistema.' });
    }

    res.setHeader('Content-Type', record.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(record.filename)}"`);
    res.setHeader('Accept-Ranges', 'bytes');

    const fileStream = createReadStream(record.filePath);
    fileStream.on('error', (streamError) => {
      console.error('Error reading local media file:', streamError);
      if (!res.headersSent) {
        res
          .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
          .send({ message: 'No se pudo abrir el archivo local.' });
      } else {
        res.end();
      }
    });
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error streaming local media file:', error);
    return res
      .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
      .send({ message: 'Error al transmitir el archivo local.' });
  }
});

mediaRouter.post('/local/:localId/convert/audio', async (req, res) => {
  try {
    const { localId } = req.params;
    const { targetFormat, bitrateKbps, quality } = req.body ?? {};
    const record = await localMediaService.getById(localId);

    if (!record) {
      return res
        .status(HttpErrorStatusCodes.NOT_FOUND)
        .send({ message: 'Archivo local no encontrado.' });
    }

    const isOwner = record.ownerId && record.ownerId === req.user?.id;
    const isAdmin = req.user?.role === USER_ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      return res
        .status(HttpErrorStatusCodes.FORBIDDEN)
        .send({ message: 'No tienes permisos para convertir este archivo.' });
    }

    if (!record.available) {
      return res
        .status(HttpErrorStatusCodes.BAD_REQUEST)
        .send({ message: 'El archivo local ya no está disponible.' });
    }

    if (record.mediaType !== 'audio') {
      return res
        .status(HttpErrorStatusCodes.BAD_REQUEST)
        .send({ message: 'Solo se pueden convertir archivos de audio locales con este endpoint.' });
    }

    if (!targetFormat || typeof targetFormat !== 'string') {
      return res
        .status(HttpErrorStatusCodes.BAD_REQUEST)
        .send({ message: 'targetFormat es obligatorio.' });
    }

    const normalizedFormat = targetFormat.toLowerCase() as AudioFormat;
    if (!AUDIO_FORMATS.includes(normalizedFormat)) {
      return res
        .status(HttpErrorStatusCodes.BAD_REQUEST)
        .send({ message: 'Formato de audio no soportado.' });
    }

    const parsedBitrate = parseOptionalNumber(bitrateKbps);
    if (
      parsedBitrate !== undefined &&
      (parsedBitrate < AUDIO_CONVERSION_LIMITS.MIN_BITRATE_KBPS ||
        parsedBitrate > AUDIO_CONVERSION_LIMITS.MAX_BITRATE_KBPS)
    ) {
      return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({
        message: `Bitrate debe estar entre ${AUDIO_CONVERSION_LIMITS.MIN_BITRATE_KBPS} y ${AUDIO_CONVERSION_LIMITS.MAX_BITRATE_KBPS} kbps.`,
      });
    }

    const parsedQuality = parseOptionalNumber(quality);
    if (
      parsedQuality !== undefined &&
      (parsedQuality < AUDIO_CONVERSION_LIMITS.MIN_QUALITY ||
        parsedQuality > AUDIO_CONVERSION_LIMITS.MAX_QUALITY)
    ) {
      return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({
        message: `Quality debe estar entre ${AUDIO_CONVERSION_LIMITS.MIN_QUALITY} y ${AUDIO_CONVERSION_LIMITS.MAX_QUALITY}.`,
      });
    }

    const converted = await convertLocalAudio({
      record,
      ownerId: req.user?.id,
      ownerUsername: req.user?.username,
      options: {
        targetFormat: normalizedFormat,
        bitrateKbps: parsedBitrate,
        quality: parsedQuality,
      },
    });

    return res
      .status(HttpSuccessStatusCodes.CREATED)
      .send({ file: converted });
  } catch (error) {
    console.error('Error converting local audio file:', error);
    return res
      .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
      .send({ message: 'No se pudo convertir el archivo local.' });
  }
});

mediaRouter.post('/local/:localId/convert/video', async (req, res) => {
  try {
    const { localId } = req.params;
    const { targetFormat, bitrateKbps, maxWidth, maxHeight } = req.body ?? {};
    const record = await localMediaService.getById(localId);

    if (!record) {
      return res
        .status(HttpErrorStatusCodes.NOT_FOUND)
        .send({ message: 'Archivo local no encontrado.' });
    }

    const isOwner = record.ownerId && record.ownerId === req.user?.id;
    const isAdmin = req.user?.role === USER_ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      return res
        .status(HttpErrorStatusCodes.FORBIDDEN)
        .send({ message: 'No tienes permisos para convertir este archivo.' });
    }

    if (!record.available) {
      return res
        .status(HttpErrorStatusCodes.BAD_REQUEST)
        .send({ message: 'El archivo local ya no está disponible.' });
    }

    if (record.mediaType !== 'video') {
      return res
        .status(HttpErrorStatusCodes.BAD_REQUEST)
        .send({ message: 'Solo se pueden convertir videos locales con este endpoint.' });
    }

    if (!targetFormat || typeof targetFormat !== 'string') {
      return res
        .status(HttpErrorStatusCodes.BAD_REQUEST)
        .send({ message: 'targetFormat es obligatorio.' });
    }

    const normalizedFormat = targetFormat.toLowerCase() as VideoFormat;
    if (!VIDEO_FORMATS.includes(normalizedFormat)) {
      return res
        .status(HttpErrorStatusCodes.BAD_REQUEST)
        .send({ message: 'Formato de video no soportado.' });
    }

    const parsedBitrate = parseOptionalNumber(bitrateKbps);
    if (
      parsedBitrate !== undefined &&
      (parsedBitrate < VIDEO_CONVERSION_LIMITS.MIN_BITRATE_KBPS ||
        parsedBitrate > VIDEO_CONVERSION_LIMITS.MAX_BITRATE_KBPS)
    ) {
      return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({
        message: `Bitrate debe estar entre ${VIDEO_CONVERSION_LIMITS.MIN_BITRATE_KBPS} y ${VIDEO_CONVERSION_LIMITS.MAX_BITRATE_KBPS} kbps.`,
      });
    }

    const parsedMaxWidth = parseOptionalNumber(maxWidth);
    if (
      parsedMaxWidth !== undefined &&
      (parsedMaxWidth < VIDEO_CONVERSION_LIMITS.MIN_WIDTH ||
        parsedMaxWidth > VIDEO_CONVERSION_LIMITS.MAX_WIDTH)
    ) {
      return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({
        message: `maxWidth debe estar entre ${VIDEO_CONVERSION_LIMITS.MIN_WIDTH} y ${VIDEO_CONVERSION_LIMITS.MAX_WIDTH} pixeles.`,
      });
    }

    const parsedMaxHeight = parseOptionalNumber(maxHeight);
    if (parsedMaxHeight !== undefined && parsedMaxHeight <= 0) {
      return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({
        message: 'maxHeight debe ser un número positivo.',
      });
    }

    const converted = await convertLocalVideo({
      record,
      ownerId: req.user?.id,
      ownerUsername: req.user?.username,
      options: {
        targetFormat: normalizedFormat,
        bitrateKbps: parsedBitrate,
        maxWidth: parsedMaxWidth,
        maxHeight: parsedMaxHeight,
      },
    });

    return res
      .status(HttpSuccessStatusCodes.CREATED)
      .send({ file: converted });
  } catch (error) {
    console.error('Error converting local video file:', error);
    return res
      .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
      .send({ message: 'No se pudo convertir el video local.' });
  }
});

mediaRouter.get('/:fileId/download', async (req, res) => {
  try {
    const { fileId } = req.params;
    const currentUserId = req.user?.id;

    const fileRef = dbConfig.db.collection(COLLECTIONS_NAMES.MEDIA_FILES).doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(HttpErrorStatusCodes.NOT_FOUND).send({ message: 'File not found.' });
    }

    const fileData = fileDoc.data() as MediaFile;

    const isOwner = fileData.ownerId === currentUserId;
    const isSharedWith = fileData.sharedWith.includes(currentUserId!);

    if (!isOwner && !isSharedWith) {
      return res.status(HttpErrorStatusCodes.FORBIDDEN).send({ message: 'You do not have permission to download this file.' });
    }

    try {
      const nodeResponse = await openNodeStream('streaming', `/streams/${fileId}`);
      nodeResponse.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      if (!nodeResponse.body) {
        throw new Error('Streaming node returned empty body');
      }
      const readable = Readable.fromWeb(nodeResponse.body as unknown as NodeReadableStream);
      readable.pipe(res);
    } catch (error) {
      if (error instanceof NodeUnavailableError) {
        return res
          .status(HttpErrorStatusCodes.SERVICE_UNAVAILABLE)
          .send({ message: 'Streaming service unavailable.' });
      }
      console.error('Error proxying stream:', error);
      return res
        .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
        .send({ message: 'Unable to stream file' });
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: 'Internal Server Error' });
  }
});


mediaRouter.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: 'No file uploaded.' });
    }
    if (!req.user) {
      return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({ message: 'User not authenticated.' });
    }

    const file = req.file;
    const userId = req.user.id;
    const fileId = uuidv4();
    const storagePath = `uploads/${userId}/${fileId}-${file.originalname}`;
    const blob = dbConfig.storage.file(storagePath);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
    });

    blobStream.on('error', (err) => {
      console.error(err);
      return res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: 'Error uploading file.' });
    });

    blobStream.on('finish', async () => {
      const fileDocRef = dbConfig.db.collection(COLLECTIONS_NAMES.MEDIA_FILES).doc(fileId);
      const newMediaFile: MediaFile = {
        filename: file.originalname,
        storagePath,
        contentType: file.mimetype,
        size: file.size,
        ownerId: userId,
        ownerUsername: req.user?.username || 'unknown',
        createdAt: admin.firestore.Timestamp.now(),
        sharedWith: [], 
      };

      await fileDocRef.set(newMediaFile);
      res.status(HttpSuccessStatusCodes.CREATED).send({ 
        message: 'File uploaded successfully', 
        file: { ...newMediaFile, id: fileId }
      });
    });

    blobStream.end(file.buffer);

  } catch (error) {
    console.error(error);
    res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: 'Internal Server Error' });
  }
});

const parseOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
};

mediaRouter.post('/:fileId/convert', async (req, res) => {
  try {
    const { fileId } = req.params;
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role;
    const currentUsername = req.user?.username || 'unknown';

    if (!currentUserId) {
      return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({ message: 'User not authenticated.' });
    }

    const { targetFormat, bitrateKbps, quality } = req.body ?? {};

    if (!targetFormat || typeof targetFormat !== 'string') {
      return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: 'targetFormat is required.' });
    }

    const normalizedFormat = targetFormat.toLowerCase() as AudioFormat;
    if (!AUDIO_FORMATS.includes(normalizedFormat)) {
      return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: 'Unsupported audio format requested.' });
    }

    const parsedBitrate = parseOptionalNumber(bitrateKbps);
    if (parsedBitrate !== undefined) {
      if (
        parsedBitrate < AUDIO_CONVERSION_LIMITS.MIN_BITRATE_KBPS ||
        parsedBitrate > AUDIO_CONVERSION_LIMITS.MAX_BITRATE_KBPS
      ) {
        return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({
          message: `Bitrate must be between ${AUDIO_CONVERSION_LIMITS.MIN_BITRATE_KBPS} and ${AUDIO_CONVERSION_LIMITS.MAX_BITRATE_KBPS} kbps.`,
        });
      }
    }

    const parsedQuality = parseOptionalNumber(quality);
    if (parsedQuality !== undefined) {
      if (
        parsedQuality < AUDIO_CONVERSION_LIMITS.MIN_QUALITY ||
        parsedQuality > AUDIO_CONVERSION_LIMITS.MAX_QUALITY
      ) {
        return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({
          message: `Quality must be between ${AUDIO_CONVERSION_LIMITS.MIN_QUALITY} and ${AUDIO_CONVERSION_LIMITS.MAX_QUALITY}.`,
        });
      }
    }

    const fileRef = dbConfig.db.collection(COLLECTIONS_NAMES.MEDIA_FILES).doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(HttpErrorStatusCodes.NOT_FOUND).send({ message: 'File not found.' });
    }

    const fileData = fileDoc.data() as MediaFile;
    const isOwner = fileData.ownerId === currentUserId;
    const isAdmin = currentUserRole === USER_ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      return res.status(HttpErrorStatusCodes.FORBIDDEN).send({ message: 'You do not have permission to convert this file.' });
    }

    if (!fileData.contentType?.startsWith('audio/')) {
      return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: 'Only audio files can be converted using this endpoint.' });
    }

    try {
      const response = await callNodeService<{ file: MediaFile }>('conversion', {
        path: '/tasks/convert/audio',
        body: {
          fileId,
          user: {
            id: currentUserId,
            username: currentUsername,
          },
          options: {
            targetFormat: normalizedFormat,
            bitrateKbps: parsedBitrate,
            quality: parsedQuality,
          },
        },
      });

      return res.status(HttpSuccessStatusCodes.CREATED).send({
        message: 'File converted successfully.',
        file: response.file,
      });
    } catch (error) {
      if (error instanceof NodeUnavailableError) {
        return res
          .status(HttpErrorStatusCodes.SERVICE_UNAVAILABLE)
          .send({ message: 'Conversion service unavailable.' });
      }
      console.error('Error converting audio file:', error);
      return res
        .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
        .send({ message: 'Internal Server Error' });
    }
  } catch (error) {
    console.error('Error validating audio conversion:', error);
    return res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: 'Internal Server Error' });
  }
});

mediaRouter.post('/:fileId/convert/video', async (req, res) => {
  try {
    const { fileId } = req.params;
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role;
    const currentUsername = req.user?.username || 'unknown';

    if (!currentUserId) {
      return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({ message: 'User not authenticated.' });
    }

    const { targetFormat, bitrateKbps, maxWidth, maxHeight } = req.body ?? {};

    if (!targetFormat || typeof targetFormat !== 'string') {
      return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: 'targetFormat is required.' });
    }

    const normalizedFormat = targetFormat.toLowerCase() as VideoFormat;
    if (!VIDEO_FORMATS.includes(normalizedFormat)) {
      return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: 'Unsupported video format requested.' });
    }

    const parsedBitrate = parseOptionalNumber(bitrateKbps);
    if (parsedBitrate !== undefined) {
      if (
        parsedBitrate < VIDEO_CONVERSION_LIMITS.MIN_BITRATE_KBPS ||
        parsedBitrate > VIDEO_CONVERSION_LIMITS.MAX_BITRATE_KBPS
      ) {
        return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({
          message: `Bitrate must be between ${VIDEO_CONVERSION_LIMITS.MIN_BITRATE_KBPS} and ${VIDEO_CONVERSION_LIMITS.MAX_BITRATE_KBPS} kbps.`,
        });
      }
    }

    const parsedMaxWidth = parseOptionalNumber(maxWidth);
    if (parsedMaxWidth !== undefined) {
      if (
        parsedMaxWidth < VIDEO_CONVERSION_LIMITS.MIN_WIDTH ||
        parsedMaxWidth > VIDEO_CONVERSION_LIMITS.MAX_WIDTH
      ) {
        return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({
          message: `maxWidth must be between ${VIDEO_CONVERSION_LIMITS.MIN_WIDTH} and ${VIDEO_CONVERSION_LIMITS.MAX_WIDTH} pixels.`,
        });
      }
    }

    const parsedMaxHeight = parseOptionalNumber(maxHeight);
    if (parsedMaxHeight !== undefined && parsedMaxHeight <= 0) {
      return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({
        message: 'maxHeight must be a positive number.',
      });
    }

    const fileRef = dbConfig.db.collection(COLLECTIONS_NAMES.MEDIA_FILES).doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(HttpErrorStatusCodes.NOT_FOUND).send({ message: 'File not found.' });
    }

    const fileData = fileDoc.data() as MediaFile;
    const isOwner = fileData.ownerId === currentUserId;
    const isAdmin = currentUserRole === USER_ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      return res.status(HttpErrorStatusCodes.FORBIDDEN).send({ message: 'You do not have permission to convert this file.' });
    }

    if (!fileData.contentType?.startsWith('video/')) {
      return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: 'Only video files can be converted using this endpoint.' });
    }

    try {
      const response = await callNodeService<{ file: MediaFile }>('conversion', {
        path: '/tasks/convert/video',
        body: {
          fileId,
          user: {
            id: currentUserId,
            username: currentUsername,
          },
          options: {
            targetFormat: normalizedFormat,
            bitrateKbps: parsedBitrate,
            maxWidth: parsedMaxWidth,
            maxHeight: parsedMaxHeight,
          },
        },
      });

      return res.status(HttpSuccessStatusCodes.CREATED).send({
        message: 'Video converted successfully.',
        file: response.file,
      });
    } catch (error) {
      if (error instanceof NodeUnavailableError) {
        return res
          .status(HttpErrorStatusCodes.SERVICE_UNAVAILABLE)
          .send({ message: 'Conversion service unavailable.' });
      }
      console.error('Error converting video file:', error);
      return res
        .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
        .send({ message: 'Internal Server Error' });
    }
  } catch (error) {
    console.error('Error validating video conversion:', error);
    return res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: 'Internal Server Error' });
  }
});

mediaRouter.get('/my-files', async (req, res) => {
  try {
    const userId = req.user?.id;
    const filesSnapshot = await dbConfig.db.collection(COLLECTIONS_NAMES.MEDIA_FILES)
      .where('ownerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
      
    const files = filesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(HttpSuccessStatusCodes.OK).send(files);

  } catch (error) {
    console.error(error);
    res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: 'Internal Server Error' });
  }
});


mediaRouter.get('/shared-with-me', async (req, res) => {
  try {
    const userId = req.user?.id;
    const filesSnapshot = await dbConfig.db.collection(COLLECTIONS_NAMES.MEDIA_FILES)
      .where('sharedWith', 'array-contains', userId) 
      .orderBy('createdAt', 'desc')
      .get();
      
    const files = filesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(HttpSuccessStatusCodes.OK).send(files);

  } catch (error) {
    console.error(error);
    res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: 'Internal Server Error' });
  }
});


mediaRouter.post('/:fileId/share', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { email: emailToShare } = req.body; 
    const currentUserId = req.user?.id;

    if (!emailToShare) {
      return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: 'Email to share is required.' });
    }

    const userSnapshot = await dbConfig.db.collection(COLLECTIONS_NAMES.USERS)
      .where('email', '==', emailToShare)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      return res.status(HttpErrorStatusCodes.NOT_FOUND).send({ message: 'User to share with not found.' });
    }
    const userToShare = userSnapshot.docs[0];
    const userToShareId = userToShare.id;
    const fileRef = dbConfig.db.collection(COLLECTIONS_NAMES.MEDIA_FILES).doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(HttpErrorStatusCodes.NOT_FOUND).send({ message: 'File not found.' });
    }

    const fileData = fileDoc.data() as MediaFile;
    if (fileData.ownerId !== currentUserId) {
      return res.status(HttpErrorStatusCodes.FORBIDDEN).send({ message: 'You do not have permission to share this file.' });
    }

    await fileRef.update({
      sharedWith: admin.firestore.FieldValue.arrayUnion(userToShareId)
    });

    res.status(HttpSuccessStatusCodes.OK).send({ message: `File shared with ${emailToShare}.` });

  } catch (error) {
    console.error(error);
    res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: 'Internal Server Error' });
  }
});


mediaRouter.delete('/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const currentUserId = req.user?.id;
        const currentUserRole = req.user?.role;
        const fileRef = dbConfig.db.collection(COLLECTIONS_NAMES.MEDIA_FILES).doc(fileId);
        const fileDoc = await fileRef.get();

        if (!fileDoc.exists) {
            return res.status(HttpErrorStatusCodes.NOT_FOUND).send({ message: 'File not found.' });
        }

        const fileData = fileDoc.data() as MediaFile;

        if (fileData.ownerId !== currentUserId && currentUserRole !== USER_ROLES.ADMIN) {
            return res.status(HttpErrorStatusCodes.FORBIDDEN).send({ message: 'You do not have permission to delete this file.' });
        }

        await dbConfig.storage.file(fileData.storagePath).delete();
        
        await fileRef.delete();

        res.status(HttpSuccessStatusCodes.OK).send({ message: 'File deleted successfully.' });

    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: 'Internal Server Error' });
    }
});
