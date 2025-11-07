import { Router } from 'express';
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
    AUDIO_CONVERSION_LIMITS
} from '../constants';
import { MediaFile } from '../models/MediaModel'; 
import { convertAudioFile } from '../services/audioConversion.service';
import type { AudioConversionOptions } from '../services/audioConversion.service';
import type { AudioFormat } from '../constants';

export const mediaRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, 
});


mediaRouter.use(authenticateUser);

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

    const bucketFile = dbConfig.storage.file(fileData.storagePath);
    const [metadata] = await bucketFile.getMetadata();

    res.setHeader('Content-Disposition', `attachment; filename="${fileData.filename}"`);
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    if (metadata.size) {
      res.setHeader('Content-Length', metadata.size);
    }

    bucketFile.createReadStream().pipe(res);

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

    const convertedFile = await convertAudioFile({
      fileId,
      mediaFile: fileData,
      ownerId: currentUserId,
      ownerUsername: currentUsername,
      options: {
        targetFormat: normalizedFormat as AudioConversionOptions['targetFormat'],
        bitrateKbps: parsedBitrate,
        quality: parsedQuality,
      },
    });

    return res.status(HttpSuccessStatusCodes.CREATED).send({
      message: 'File converted successfully.',
      file: convertedFile,
    });
  } catch (error) {
    console.error('Error converting audio file:', error);
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