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
  AUDIO_CONVERSION_DEFAULTS,
  AUDIO_MIME_TYPES,
  COLLECTIONS_NAMES,
} from '../constants';
import type { AudioFormat } from '../constants';
import { MediaFile } from '../models/MediaModel';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const TMP_PREFIX = 'media-convert-';

export interface AudioConversionOptions {
  targetFormat: AudioFormat;
  bitrateKbps?: number;
  quality?: number;
}

interface ConvertAudioParams {
  fileId: string;
  mediaFile: MediaFile;
  ownerId: string;
  ownerUsername: string;
  options: AudioConversionOptions;
}

const downloadToTemp = async (storagePath: string, destination: string) => {
  const file = dbConfig.storage.file(storagePath);
  await pipeline(file.createReadStream(), createWriteStream(destination));
};

const runFfmpegConversion = async (
  inputPath: string,
  outputPath: string,
  options: Required<AudioConversionOptions>,
) => {
  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .audioBitrate(`${options.bitrateKbps}k`)
      .format(options.targetFormat)
      .outputOptions('-vn'); // strip video streams just in case

    if (typeof options.quality === 'number') {
      command.audioQuality(options.quality);
    }

    command
      .on('end', () => resolve())
      .on('error', (error: Error) => reject(error))
      .save(outputPath);
  });
};

export const convertAudioFile = async ({
  fileId,
  mediaFile,
  ownerId,
  ownerUsername,
  options,
}: ConvertAudioParams) => {
  const normalizedFormat = options.targetFormat;
  const bitrateKbps = options.bitrateKbps ?? AUDIO_CONVERSION_DEFAULTS.BITRATE_KBPS;
  const quality = options.quality ?? AUDIO_CONVERSION_DEFAULTS.QUALITY;

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), TMP_PREFIX));
  const inputPath = path.join(tempDir, `original-${uuidv4()}`);
  const convertedFilename = `${path.parse(mediaFile.filename).name}-${normalizedFormat}-${Date.now()}.${normalizedFormat}`;
  const outputPath = path.join(tempDir, convertedFilename);

  try {
    await downloadToTemp(mediaFile.storagePath, inputPath);

    await runFfmpegConversion(inputPath, outputPath, {
      targetFormat: normalizedFormat,
      bitrateKbps,
      quality,
    });

    const { size } = await fsPromises.stat(outputPath);
    const newFileId = uuidv4();
    const storagePath = `conversions/${ownerId}/${newFileId}/${convertedFilename}`;
    const contentType = AUDIO_MIME_TYPES[normalizedFormat] ?? `audio/${normalizedFormat}`;

    await dbConfig.storage.upload(outputPath, {
      destination: storagePath,
      metadata: {
        contentType,
      },
    });

    const convertedFile: MediaFile = {
      filename: convertedFilename,
      storagePath,
      contentType,
      size,
      ownerId,
      ownerUsername,
      createdAt: admin.firestore.Timestamp.now(),
      sharedWith: [],
      conversion: {
        sourceFileId: fileId,
        targetFormat: normalizedFormat,
        bitrateKbps,
        quality,
      },
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
