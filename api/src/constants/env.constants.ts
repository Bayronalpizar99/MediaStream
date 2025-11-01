export const ENV_VARIABLES = {
    PORT: 'PORT',
    NODE_ENV: 'NODE_ENV',
    CORS_ORIGIN: 'CORS_ORIGIN',
    MONGO_URI: 'MONGO_URI',
    AUDIO_LIBRARY_PATH: 'AUDIO_LIBRARY_PATH',
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