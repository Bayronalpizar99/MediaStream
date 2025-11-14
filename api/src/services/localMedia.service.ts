import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';
import mime from 'mime-types';
import { HttpErrorStatusCodes, LOCAL_MEDIA_CONFIG } from '../constants';

sqlite3.verbose();

class LocalMediaError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = HttpErrorStatusCodes.BAD_REQUEST) {
    super(message);
    this.name = 'LocalMediaError';
    this.statusCode = statusCode;
  }
}

const ensureDirectory = async (dirPath: string) => {
  await fsPromises.mkdir(dirPath, { recursive: true });
};

const baseDir = path.resolve(LOCAL_MEDIA_CONFIG.BASE_DIR);
const dbDir = path.dirname(LOCAL_MEDIA_CONFIG.DB_PATH);

await ensureDirectory(baseDir);
await ensureDirectory(dbDir);

const database = new sqlite3.Database(
  LOCAL_MEDIA_CONFIG.DB_PATH,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
);

type RunResult = sqlite3.RunResult;

const run = (sql: string, params: unknown[] = []) =>
  new Promise<RunResult>((resolve, reject) => {
    database.run(sql, params, function runCallback(err) {
      if (err) {
        return reject(err);
      }
      return resolve(this);
    });
  });

const all = <T>(sql: string, params: unknown[] = []) =>
  new Promise<T[]>((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      return resolve(rows as T[]);
    });
  });

const get = <T>(sql: string, params: unknown[] = []) =>
  new Promise<T | undefined>((resolve, reject) => {
    database.get(sql, params, (err, row) => {
      if (err) {
        return reject(err);
      }
      return resolve(row as T | undefined);
    });
  });

const ensureMetadataColumn = async () => {
  const columns = await all<{ name: string }>(
    'PRAGMA table_info(local_media_files)',
  );
  if (!columns.some((col) => col.name === 'metadata')) {
    await run('ALTER TABLE local_media_files ADD COLUMN metadata TEXT');
  }
};

const initPromise = (async () => {
  await run('PRAGMA journal_mode = WAL;');
  await run(`CREATE TABLE IF NOT EXISTS local_media_files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    relative_path TEXT NOT NULL,
    content_type TEXT NOT NULL,
    media_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    owner_id TEXT,
    owner_username TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    metadata TEXT
  )`);
  await ensureMetadataColumn();
})();

export type LocalMediaType = 'audio' | 'video';
export type LocalMediaSource = 'local';

export interface LocalConversionMetadata {
  type: LocalMediaType;
  sourceLocalId: string;
  targetFormat: string;
  bitrateKbps?: number;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface LocalMediaMetadata {
  conversion?: LocalConversionMetadata;
}

export interface LocalMediaRecord {
  id: string;
  filename: string;
  filePath: string;
  relativePath: string;
  contentType: string;
  mediaType: LocalMediaType;
  size: number;
  ownerId?: string | null;
  ownerUsername?: string | null;
  createdAt: string;
  updatedAt: string;
  available: boolean;
  source: LocalMediaSource;
  conversion?: LocalConversionMetadata;
}

interface DbRow {
  id: string;
  filename: string;
  file_path: string;
  relative_path: string;
  content_type: string;
  media_type: LocalMediaType;
  size: number;
  owner_id?: string | null;
  owner_username?: string | null;
  created_at: string;
  updated_at: string;
  metadata?: string | null;
}

const parseMetadata = (value?: string | null): LocalMediaMetadata | undefined => {
  if (!value) {
    return undefined;
  }
  try {
    return JSON.parse(value) as LocalMediaMetadata;
  } catch (error) {
    console.warn('Failed to parse local media metadata', error);
    return undefined;
  }
};

const mapRow = (row: DbRow): LocalMediaRecord => {
  const metadata = parseMetadata(row.metadata);
  return {
    id: row.id,
    filename: row.filename,
    filePath: row.file_path,
    relativePath: row.relative_path,
    contentType: row.content_type,
    mediaType: row.media_type,
    size: row.size,
    ownerId: row.owner_id,
    ownerUsername: row.owner_username,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    available: fs.existsSync(row.file_path),
    source: 'local',
    conversion: metadata?.conversion,
  };
};

const resolveRelativePath = (targetPath: string) => {
  const relative = path.relative(baseDir, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new LocalMediaError('El archivo debe estar dentro del directorio local configurado.');
  }
  return relative;
};

const normalizeInputPath = (inputPath: string) => {
  if (!inputPath) {
    throw new LocalMediaError('La ruta del archivo es obligatoria.');
  }
  const candidate = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(baseDir, inputPath);
  return path.normalize(candidate);
};

const detectMediaType = (contentType: string): LocalMediaType => {
  if (contentType.startsWith('video/')) {
    return 'video';
  }
  return 'audio';
};

export interface CreateLocalMediaInput {
  filePath: string;
  displayName?: string;
  ownerId?: string;
  ownerUsername?: string;
}

const serializeMetadata = (metadata?: LocalMediaMetadata) =>
  metadata ? JSON.stringify(metadata) : null;

export const localMediaService = {
  async list(): Promise<LocalMediaRecord[]> {
    await initPromise;
    const rows = await all<DbRow>(
      'SELECT * FROM local_media_files ORDER BY created_at DESC',
    );
    return rows.map(mapRow);
  },

  async getById(id: string): Promise<LocalMediaRecord | undefined> {
    await initPromise;
    const row = await get<DbRow>(
      'SELECT * FROM local_media_files WHERE id = ? LIMIT 1',
      [id],
    );
    return row ? mapRow(row) : undefined;
  },

  async create(
    input: CreateLocalMediaInput,
    metadata?: LocalMediaMetadata,
  ): Promise<LocalMediaRecord> {
    await initPromise;
    const normalizedTarget = normalizeInputPath(input.filePath);

    const relativePath = resolveRelativePath(normalizedTarget);
    const fileStats = await fsPromises.stat(normalizedTarget);

    if (!fileStats.isFile()) {
      throw new LocalMediaError('La ruta proporcionada no corresponde a un archivo.');
    }

    const mimeType =
      (mime.lookup(normalizedTarget) as string | false) ||
      'application/octet-stream';

    if (
      !LOCAL_MEDIA_CONFIG.ALLOWED_MIME_PREFIXES.some((prefix) =>
        mimeType.startsWith(prefix),
      )
    ) {
      throw new LocalMediaError(
        'Solo se permiten archivos de audio o vídeo para la biblioteca local.',
      );
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const filename = input.displayName ?? path.basename(normalizedTarget);
    const mediaType = detectMediaType(mimeType);

    try {
      await run(
        `INSERT INTO local_media_files (
          id,
          filename,
          file_path,
          relative_path,
          content_type,
          media_type,
          size,
          owner_id,
          owner_username,
          created_at,
          updated_at,
          metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          filename,
          normalizedTarget,
          relativePath,
          mimeType,
          mediaType,
          fileStats.size,
          input.ownerId ?? null,
          input.ownerUsername ?? null,
          now,
          now,
          serializeMetadata(metadata),
        ],
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('UNIQUE constraint failed')
      ) {
        throw new LocalMediaError('Este archivo ya fue agregado a la biblioteca local.');
      }
      throw error;
    }

    const created = await this.getById(id);
    if (!created) {
      throw new LocalMediaError('No se pudo registrar el archivo local.', HttpErrorStatusCodes.INTERNAL_SERVER_ERROR);
    }
    return created;
  },

  async remove(id: string): Promise<boolean> {
    await initPromise;
    const result = await run('DELETE FROM local_media_files WHERE id = ?', [
      id,
    ]);
    return result.changes > 0;
  },
};

export { LocalMediaError, baseDir as localMediaBaseDir };

process.on('SIGINT', () => {
  database.close(() => {
    process.exit(0);
  });
});
