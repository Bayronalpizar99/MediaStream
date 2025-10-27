import {
  ERROR_MESSAGES,
  AUTH_ERROR_MESSAGES,
  AUTH_MESSAGES,
  FILE_ERROR_MESSAGES,
  FILE_MESSAGES
} from './message.constants';
import {
  ENV_VARIABLES,
  VALID_NODE_ENVS,
  getEnvVar,
  FIREBASE_STORAGE_BUCKET,
  JWT_SECRET_KEY // <-- AÑADE ESTO
} from './env.constants';
import { LOG_FORMATS } from './log.constants';
import { STRINGS } from './strings.constants';
import { API_INFO } from './infoApi.constants';
import { HEALTH_CONSTANTS } from './health.constants';
import { COLLECTIONS_NAMES, COLLECTIONS_FIELDS } from "./collections.constants";
import {
  HttpErrorStatusCodes,
  HttpRedirectionStatusCodes,
  HttpSuccessStatusCodes
} from './httpCodes.constants';
import { INDEXES, NUMBERS } from './numbers.constants';
import {
  HTTP_METHODS,
  HTTP_HEADERS,
  CORS_CONFIG,
  CONTENT_TYPES
} from './http.constants';
// ❗️ NOTA: La importación de HTTP_STATUS se eliminó porque no existe.

export {
  ERROR_MESSAGES,
  ENV_VARIABLES,
  VALID_NODE_ENVS,
  API_INFO,
  STRINGS,
  LOG_FORMATS,
  HEALTH_CONSTANTS,
  getEnvVar,
  AUTH_ERROR_MESSAGES,
  COLLECTIONS_NAMES,
  COLLECTIONS_FIELDS,
  AUTH_MESSAGES,
  HttpErrorStatusCodes,
  HttpSuccessStatusCodes,
  HttpRedirectionStatusCodes,
  INDEXES,
  NUMBERS,
  HTTP_METHODS,
  HTTP_HEADERS,
  CORS_CONFIG,
  CONTENT_TYPES,
  FIREBASE_STORAGE_BUCKET,
  FILE_ERROR_MESSAGES,
  FILE_MESSAGES,
  JWT_SECRET_KEY // <-- AÑADE ESTO
};