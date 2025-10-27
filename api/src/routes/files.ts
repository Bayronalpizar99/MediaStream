import { Router, Request } from 'express';
import multer from 'multer';
import { db, bucket, admin } from '../config/firebase';
import {
  // 👇 CAMBIO: Usamos tus constantes
  HttpSuccessStatusCodes,
  HttpErrorStatusCodes,
  COLLECTIONS_NAMES,
  STRINGS,
  ERROR_MESSAGES,
  FILE_ERROR_MESSAGES,
  FILE_MESSAGES
} from '../constants';
import { authMiddleware } from '../middleware/auth';

// ... (el tipo UserPayload no cambia) ...
type UserPayload = {
  id: string;
  email: string;
  username: string;
};

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const filesRouter = Router();
filesRouter.use(authMiddleware);

/**
 * @route POST /files/upload
 * @description Sube un nuevo archivo multimedia.
 */
filesRouter.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res) => {
    try {
      const user = (req as any).user as UserPayload;

      if (!req.file) {
        return res
          // 👇 CAMBIO
          .status(HttpErrorStatusCodes.BAD_REQUEST)
          .json({ message: FILE_ERROR_MESSAGES.NO_FILE_PROVIDED });
      }

      // ... (lógica de subida de archivos no cambia) ...
      const storagePath = `users/${user.id}/${Date.now()}-${req.file.originalname}`;
      const fileRef = bucket.file(storagePath);
      await fileRef.save(req.file.buffer, {
        contentType: req.file.mimetype
      });
      const [downloadURL] = await fileRef.getSignedUrl({
        action: 'read',
        expires: '03-09-2491'
      });
      const fileMetadata = {
        name: req.file.originalname,
        format: req.file.mimetype,
        size: req.file.size,
        storagePath: storagePath,
        downloadURL: downloadURL,
        ownerId: user.id,
        ownerEmail: user.email,
        sharedWith: [],
        uploadDate: admin.firestore.FieldValue.serverTimestamp(),
        node: STRINGS.DEFAULT_NODE
      };
      const docRef = await db.collection(COLLECTIONS_NAMES.MEDIA_FILES).add(fileMetadata);

      return res
        // 👇 CAMBIO
        .status(HttpSuccessStatusCodes.CREATED)
        .json({
          message: FILE_MESSAGES.UPLOAD_SUCCESS,
          fileId: docRef.id,
          downloadURL: downloadURL,
          name: req.file.originalname,
          format: req.file.mimetype
        });

    } catch (error) {
      console.error('Error uploading file:', error);
      return res
        // 👇 CAMBIO
        .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
        .json({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
    }
  }
);

/**
 * @route GET /files/my-files
 * @description Obtiene la lista de archivos del usuario logueado.
 */
filesRouter.get('/my-files', async (req: Request, res) => {
  try {
    const user = (req as any).user as UserPayload;
    const files: any[] = [];

    const q = db.collection(COLLECTIONS_NAMES.MEDIA_FILES).where('ownerId', '==', user.id);
    const querySnapshot = await q.get();

    querySnapshot.forEach((doc) => {
      files.push({
        id: doc.id,
        ...doc.data()
      });
    });
    // 👇 CAMBIO
    return res.status(HttpSuccessStatusCodes.OK).json(files);

  } catch (error) {
    console.error('Error fetching files:', error);
    return res
      // 👇 CAMBIO
      .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
  }
});

export { filesRouter };