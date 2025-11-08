import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import dbConfig from '../config';
import {
  COLLECTIONS_NAMES,
  HttpErrorStatusCodes,
  HttpSuccessStatusCodes,
} from '../constants';
import { convertAudioFile } from '../services/audioConversion.service';
import { convertVideoFile } from '../services/videoConversion.service';
import type { AudioFormat, VideoFormat } from '../constants';

const app = express();
app.use(express.json());
app.use(morgan('dev'));

const PORT = Number(process.env.CONVERSION_NODE_PORT ?? 4001);
const NODE_ID = process.env.CONVERSION_NODE_ID ?? randomUUID();
const NODE_NAME = process.env.CONVERSION_NODE_NAME ?? 'conversion-node';
const COORDINATOR_URL =
  process.env.COORDINATOR_URL ?? 'http://localhost:3000';
const SHARED_SECRET = process.env.NODE_SHARED_SECRET;
let activeTasks = 0;

app.use((req, res, next) => {
  if (!SHARED_SECRET || req.path === '/health') {
    return next();
  }
  const headerSecret = req.headers['x-node-secret'];
  if (headerSecret !== SHARED_SECRET) {
    return res
      .status(HttpErrorStatusCodes.UNAUTHORIZED)
      .send({ message: 'Unauthorized node request' });
  }
  return next();
});

const registerWithCoordinator = async () => {
  try {
    await fetch(`${COORDINATOR_URL}/nodes/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: NODE_ID,
        name: NODE_NAME,
        role: 'conversion',
        baseUrl: `http://localhost:${PORT}`,
        location: process.env.NODE_LOCATION ?? 'local',
      }),
    });
    console.log(`[${NODE_NAME}] Registered with coordinator`);
  } catch (error) {
    console.error(`[${NODE_NAME}] Failed to register node:`, error);
  }
};

const sendHeartbeat = async () => {
  try {
    await fetch(`${COORDINATOR_URL}/nodes/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: NODE_ID,
        metrics: {
          cpu: Math.min(
            100,
            (os.loadavg()[0] / os.cpus().length) * 100,
          ),
          ram: Math.min(
            100,
            (process.memoryUsage().rss / os.totalmem()) * 100,
          ),
          uptimeSeconds: process.uptime(),
          tasks: activeTasks,
        },
      }),
    });
  } catch (error) {
    console.error(`[${NODE_NAME}] Heartbeat error:`, error);
  }
};

const getMediaFile = async (fileId: string) => {
  const fileRef = dbConfig.db.collection(COLLECTIONS_NAMES.MEDIA_FILES).doc(fileId);
  const fileDoc = await fileRef.get();
  if (!fileDoc.exists) {
    return null;
  }
  return { id: fileDoc.id, ...(fileDoc.data() as any) };
};

app.post('/tasks/convert/audio', async (req, res) => {
  try {
    const { fileId, user, options } = req.body as {
      fileId: string;
      user: { id: string; username: string };
      options: {
        targetFormat: AudioFormat;
        bitrateKbps?: number;
        quality?: number;
      };
    };

    if (!fileId || !options?.targetFormat) {
      return res
        .status(HttpErrorStatusCodes.BAD_REQUEST)
        .send({ message: 'fileId and targetFormat are required' });
    }

    const mediaFile = await getMediaFile(fileId);

    if (!mediaFile) {
      return res
        .status(HttpErrorStatusCodes.NOT_FOUND)
        .send({ message: 'Source file not found' });
    }

    activeTasks += 1;
    const convertedFile = await convertAudioFile({
      fileId,
      mediaFile,
      ownerId: user?.id ?? mediaFile.ownerId,
      ownerUsername: user?.username ?? mediaFile.ownerUsername,
      options,
    });

    return res
      .status(HttpSuccessStatusCodes.CREATED)
      .send({ file: convertedFile });
  } catch (error) {
    console.error(`[${NODE_NAME}] audio conversion error:`, error);
    return res
      .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
      .send({ message: 'Conversion failed' });
  } finally {
    activeTasks = Math.max(0, activeTasks - 1);
  }
});

app.post('/tasks/convert/video', async (req, res) => {
  try {
    const { fileId, user, options } = req.body as {
      fileId: string;
      user: { id: string; username: string };
      options: {
        targetFormat: VideoFormat;
        bitrateKbps?: number;
        maxWidth?: number;
        maxHeight?: number;
      };
    };

    if (!fileId || !options?.targetFormat) {
      return res
        .status(HttpErrorStatusCodes.BAD_REQUEST)
        .send({ message: 'fileId and targetFormat are required' });
    }

    const mediaFile = await getMediaFile(fileId);

    if (!mediaFile) {
      return res
        .status(HttpErrorStatusCodes.NOT_FOUND)
        .send({ message: 'Source file not found' });
    }

    activeTasks += 1;
    const convertedFile = await convertVideoFile({
      fileId,
      mediaFile,
      ownerId: user?.id ?? mediaFile.ownerId,
      ownerUsername: user?.username ?? mediaFile.ownerUsername,
      options: {
        targetFormat: options.targetFormat,
        videoBitrateKbps: options.bitrateKbps,
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
      },
    });

    return res
      .status(HttpSuccessStatusCodes.CREATED)
      .send({ file: convertedFile });
  } catch (error) {
    console.error(`[${NODE_NAME}] video conversion error:`, error);
    return res
      .status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR)
      .send({ message: 'Conversion failed' });
  } finally {
    activeTasks = Math.max(0, activeTasks - 1);
  }
});

app.get('/health', (_req, res) => {
  res.send({
    nodeId: NODE_ID,
    name: NODE_NAME,
    role: 'conversion',
    status: 'online',
    uptimeSeconds: process.uptime(),
  });
});

app.listen(PORT, async () => {
  console.log(`[${NODE_NAME}] Listening on http://localhost:${PORT}`);
  await registerWithCoordinator();
  await sendHeartbeat();
  setInterval(sendHeartbeat, 5_000);
});
