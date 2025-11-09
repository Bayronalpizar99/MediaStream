import path from 'node:path';
import os from 'node:os';
import { promises as fsPromises } from 'node:fs';
import { randomUUID } from 'node:crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import {
  AUDIO_CONVERSION_DEFAULTS,
  VIDEO_CONVERSION_DEFAULTS,
  LOCAL_MEDIA_CONFIG,
} from '../constants';
import type { AudioFormat, VideoFormat } from '../constants';
import {
  localMediaService,
  LocalMediaRecord,
  LocalMediaMetadata,
  LocalConversionMetadata,
} from './localMedia.service';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const TEMP_PREFIX = 'local-conversion-';

const ensureDir = async (dir: string) => {
  await fsPromises.mkdir(dir, { recursive: true });
};

const getOutputDirectory = async (ownerId?: string | null) => {
  const ownerSegment = ownerId || 'shared';
  const dir = path.join(LOCAL_MEDIA_CONFIG.BASE_DIR, 'conversions', ownerSegment);
  await ensureDir(dir);
  return dir;
};

const buildFilename = (baseName: string, targetFormat: string) => {
  const parsed = path.parse(baseName);
  return `${parsed.name}-${targetFormat}-${Date.now()}.${targetFormat}`;
};

interface ConvertLocalAudioParams {
  record: LocalMediaRecord;
  ownerId?: string;
  ownerUsername?: string;
  options: {
    targetFormat: AudioFormat;
    bitrateKbps?: number;
    quality?: number;
  };
}

interface ConvertLocalVideoParams {
  record: LocalMediaRecord;
  ownerId?: string;
  ownerUsername?: string;
  options: {
    targetFormat: VideoFormat;
    bitrateKbps?: number;
    maxWidth?: number;
    maxHeight?: number;
  };
}

const runAudioFfmpeg = async (
  inputPath: string,
  outputPath: string,
  options: Required<ConvertLocalAudioParams['options']>,
) => {
  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .audioBitrate(`${options.bitrateKbps}k`)
      .format(options.targetFormat)
      .outputOptions('-vn');

    if (typeof options.quality === 'number') {
      command.audioQuality(options.quality);
    }

    command
      .on('end', () => resolve())
      .on('error', (error: Error) => reject(error))
      .save(outputPath);
  });
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

const runVideoFfmpeg = async (
  inputPath: string,
  outputPath: string,
  options: {
    targetFormat: VideoFormat;
    bitrateKbps: number;
    maxWidth?: number;
    maxHeight?: number;
  },
) => {
  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .videoBitrate(`${options.bitrateKbps}k`)
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

const finalizeConversion = async (
  tempOutputPath: string,
  finalFilename: string,
  ownerId?: string,
  ownerUsername?: string,
  metadata?: LocalMediaMetadata,
) => {
  const outputDir = await getOutputDirectory(ownerId);
  const finalPath = path.join(outputDir, finalFilename);
  try {
    await fsPromises.rename(tempOutputPath, finalPath);
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'EXDEV'
    ) {
      await fsPromises.copyFile(tempOutputPath, finalPath);
      await fsPromises.unlink(tempOutputPath);
    } else {
      throw error;
    }
  }

  return localMediaService.create(
    {
      filePath: finalPath,
      displayName: finalFilename,
      ownerId,
      ownerUsername,
    },
    metadata,
  );
};

export const convertLocalAudio = async ({
  record,
  ownerId,
  ownerUsername,
  options,
}: ConvertLocalAudioParams) => {
  const normalizedFormat = options.targetFormat;
  const bitrateKbps = options.bitrateKbps ?? AUDIO_CONVERSION_DEFAULTS.BITRATE_KBPS;
  const quality = options.quality ?? AUDIO_CONVERSION_DEFAULTS.QUALITY;

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  const outputFilename = buildFilename(record.filename, normalizedFormat);
  const tempOutputPath = path.join(tempDir, outputFilename);

  try {
    await runAudioFfmpeg(record.filePath, tempOutputPath, {
      targetFormat: normalizedFormat,
      bitrateKbps,
      quality,
    });

    const metadata: LocalMediaMetadata = {
      conversion: {
        type: 'audio',
        sourceLocalId: record.id,
        targetFormat: normalizedFormat,
        bitrateKbps,
        quality,
      },
    };

    return await finalizeConversion(
      tempOutputPath,
      outputFilename,
      ownerId,
      ownerUsername,
      metadata,
    );
  } finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  }
};

export const convertLocalVideo = async ({
  record,
  ownerId,
  ownerUsername,
  options,
}: ConvertLocalVideoParams) => {
  const normalizedFormat = options.targetFormat;
  const bitrate = options.bitrateKbps ?? VIDEO_CONVERSION_DEFAULTS.BITRATE_KBPS;
  const maxWidth = options.maxWidth ?? VIDEO_CONVERSION_DEFAULTS.MAX_WIDTH;
  const maxHeight = options.maxHeight;

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  const outputFilename = buildFilename(record.filename, normalizedFormat);
  const tempOutputPath = path.join(tempDir, outputFilename);

  try {
    await runVideoFfmpeg(record.filePath, tempOutputPath, {
      targetFormat: normalizedFormat,
      bitrateKbps: bitrate,
      maxWidth,
      maxHeight,
    });

    const conversionMetadata: LocalConversionMetadata = {
      type: 'video',
      sourceLocalId: record.id,
      targetFormat: normalizedFormat,
      bitrateKbps: bitrate,
      maxWidth,
    };

    if (typeof maxHeight === 'number') {
      conversionMetadata.maxHeight = maxHeight;
    }

    const metadata: LocalMediaMetadata = {
      conversion: conversionMetadata,
    };

    return await finalizeConversion(
      tempOutputPath,
      outputFilename,
      ownerId,
      ownerUsername,
      metadata,
    );
  } finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  }
};
