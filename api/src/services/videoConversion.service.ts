import path from 'node:path';
import os from 'node:os';
import { promises as fsPromises } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import admin from 'firebase-admin';
import dbConfig from '../config';
import {
  VIDEO_CONVERSION_DEFAULTS,
  VIDEO_MIME_TYPES,
  COLLECTIONS_NAMES,
} from '../constants';
import type { VideoFormat } from '../constants';
import { MediaFile } from '../models/MediaModel';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const TMP_PREFIX = 'media-video-convert-';

export interface VideoConversionOptions {
  targetFormat: VideoFormat;
  videoBitrateKbps?: number;
  maxWidth?: number;
  maxHeight?: number;
}

interface ConvertVideoParams {
  fileId: string;
  mediaFile: MediaFile;
  ownerId: string;
  ownerUsername: string;
  options: VideoConversionOptions;
}

const downloadToTemp = async (storagePath: string, destination: string) => {
  const file = dbConfig.storage.file(storagePath);
  await pipeline(file.createReadStream(), createWriteStream(destination));
};

const buildScaleFilter = (maxWidth?: number, maxHeight?: number): string | null => {
  if (!maxWidth && !maxHeight) {
    return null;
  }
  if (maxWidth && maxHeight) {
    return `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)'`;
  }
  if (maxWidth) {
    return `scale='min(${maxWidth},iw)':-2`;
  }
  return `scale=-2:'min(${maxHeight},ih)'`;
};

const runFfmpegConversion = async (
  inputPath: string,
  outputPath: string,
  options: {
    targetFormat: VideoFormat;
    videoBitrateKbps: number;
    maxWidth?: number;
    maxHeight?: number;
  },
) => {
  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .videoBitrate(`${options.videoBitrateKbps}k`)
      .format(options.targetFormat)
      .audioBitrate('160k')
      .outputOptions('-movflags', 'faststart')
      .outputOptions('-preset', 'fast')
      .outputOptions('-pix_fmt', 'yuv420p');

    const scaleFilter = buildScaleFilter(options.maxWidth, options.maxHeight);
    if (scaleFilter) {
      command.videoFilters(scaleFilter);
    }

    command
      .on('end', () => resolve())
      .on('error', (error: Error) => reject(error))
      .save(outputPath);
  });
};

export const convertVideoFile = async ({
  fileId,
  mediaFile,
  ownerId,
  ownerUsername,
  options,
}: ConvertVideoParams) => {
  const normalizedFormat = options.targetFormat;
  const videoBitrate = options.videoBitrateKbps ?? VIDEO_CONVERSION_DEFAULTS.BITRATE_KBPS;
  const maxWidth = options.maxWidth ?? VIDEO_CONVERSION_DEFAULTS.MAX_WIDTH;
  const maxHeight = options.maxHeight;

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), TMP_PREFIX));
  const inputPath = path.join(tempDir, `source-${uuidv4()}`);
  const convertedFilename = `${path.parse(mediaFile.filename).name}-${normalizedFormat}-${Date.now()}.${normalizedFormat}`;
  const outputPath = path.join(tempDir, convertedFilename);

  try {
    await downloadToTemp(mediaFile.storagePath, inputPath);

    await runFfmpegConversion(inputPath, outputPath, {
      targetFormat: normalizedFormat,
      videoBitrateKbps: videoBitrate,
      maxWidth,
      maxHeight,
    });

    const { size } = await fsPromises.stat(outputPath);
    const newFileId = uuidv4();
    const storagePath = `conversions/${ownerId}/${newFileId}/${convertedFilename}`;
    const contentType = VIDEO_MIME_TYPES[normalizedFormat] ?? `video/${normalizedFormat}`;

    await dbConfig.storage.upload(outputPath, {
      destination: storagePath,
      metadata: {
        contentType,
      },
    });

    const conversionMetadata: MediaFile['conversion'] = {
      type: 'video',
      sourceFileId: fileId,
      targetFormat: normalizedFormat,
      bitrateKbps: videoBitrate,
    };

    if (typeof maxWidth === 'number') {
      conversionMetadata.maxWidth = maxWidth;
    }

    if (typeof maxHeight === 'number') {
      conversionMetadata.maxHeight = maxHeight;
    }

    const convertedFile: MediaFile = {
      filename: convertedFilename,
      storagePath,
      contentType,
      size,
      ownerId,
      ownerUsername,
      createdAt: admin.firestore.Timestamp.now(),
      sharedWith: [],
      conversion: conversionMetadata,
    };

    await dbConfig.db
      .collection(COLLECTIONS_NAMES.MEDIA_FILES)
      .doc(newFileId)
      .set(convertedFile);

    return { id: newFileId, ...convertedFile };
  } finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  }
};
