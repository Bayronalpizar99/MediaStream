// HTTP Methods
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  OPTIONS: 'OPTIONS',
  HEAD: 'HEAD',
} as const;

// HTTP Headers
export const HTTP_HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  AUTHORIZATION: 'Authorization',
  ACCEPT: 'Accept',
  USER_AGENT: 'User-Agent',
  CACHE_CONTROL: 'Cache-Control',
  ORIGIN: 'Origin',
  REFERER: 'Referer',
} as const;

// CORS Configuration
export const CORS_CONFIG = {
  METHODS: [
    HTTP_METHODS.GET,
    HTTP_METHODS.POST,
    HTTP_METHODS.PUT,
    HTTP_METHODS.DELETE,
    HTTP_METHODS.OPTIONS,
  ] as string[],
  ALLOWED_HEADERS: [
    HTTP_HEADERS.CONTENT_TYPE,
    HTTP_HEADERS.AUTHORIZATION,
  ] as string[],
  CREDENTIALS: true,
} as const;

// Content Types
export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_DATA: 'multipart/form-data',
  URL_ENCODED: 'application/x-www-form-urlencoded',
  TEXT_PLAIN: 'text/plain',
  TEXT_HTML: 'text/html',
} as const;