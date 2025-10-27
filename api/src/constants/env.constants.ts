export const ENV_VARIABLES = {
  PORT: 'PORT',
  NODE_ENV: 'NODE_ENV',
  CORS_ORIGIN: 'CORS_ORIGIN',
  MONGO_URI: 'MONGO_URI',
  FIREBASE_STORAGE_BUCKET: 'FIREBASE_STORAGE_BUCKET',
  JWT_SECRET_KEY: 'JWT_SECRET_KEY', // <-- AÑADE ESTO
};

export const VALID_NODE_ENVS = {
  PRODUCTION: 'production',
  DEVELOPMENT: 'development',
  TEST: 'test',
}

/**
 * Get an environment variable with optional validation
 */
export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue!;
}

// 👇 AÑADE ESTAS DOS LÍNEAS
export const FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET;
export const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'secreto-por-defecto';