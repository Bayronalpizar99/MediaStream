export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL,
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/auth/login',
      REGISTER: '/auth/register',
      LOGOUT: '/auth/logout',
      HEARTBEAT: '/auth/sessions/heartbeat',
      GET_SESSIONS: '/auth/sessions',
      TERMINATE_SESSION: (sessionId: string) => `/auth/sessions/${sessionId}/terminate`,
    },
    MEDIA: {
      UPLOAD: '/media/upload',
      MY_FILES: '/media/my-files',
      SHARED_WITH_ME: '/media/shared-with-me',
      SHARE: (fileId: string) => `/media/${fileId}/share`,
      DELETE: (fileId: string) => `/media/${fileId}`,
      DOWNLOAD: (fileId: string) => `/media/${fileId}/download`,
      CONVERT: (fileId: string) => `/media/${fileId}/convert`,
      CONVERT_VIDEO: (fileId: string) => `/media/${fileId}/convert/video`,
    },
    NODES: {
      STATUS: '/nodes/status',
    },
    HEALTH: '/health',
  },
} as const;

// HTTP Methods
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
} as const;

// HTTP Headers
export const HTTP_HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  AUTHORIZATION: 'Authorization',
  ACCEPT: 'Accept',
} as const;

// Content Types
export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_DATA: 'multipart/form-data',
  URL_ENCODED: 'application/x-www-form-urlencoded',
} as const;
