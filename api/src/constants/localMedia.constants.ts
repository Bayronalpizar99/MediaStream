import path from 'node:path';

const resolvePath = (value: string | undefined, fallback: string) => {
  if (!value) {
    return fallback;
  }
  return path.resolve(value);
};

const WORKDIR = process.cwd();

export const LOCAL_MEDIA_CONFIG = {
  BASE_DIR: resolvePath(
    process.env.LOCAL_MEDIA_DIR,
    path.resolve(WORKDIR, 'media'),
  ),
  DB_PATH: resolvePath(
    process.env.LOCAL_MEDIA_DB_PATH,
    path.resolve(WORKDIR, 'storage', 'local-media.db'),
  ),
  ALLOWED_MIME_PREFIXES: ['audio/', 'video/'],
} as const;

