import {
  API_CONFIG,
  HTTP_METHODS,
  HTTP_HEADERS,
  CONTENT_TYPES,
  ERROR_CODES,
  ERROR_MESSAGES,
  SESSION_HEADERS
} from '../constants';
import { AudioFile, AudioListResponse, AudioUploadResponse } from '../models';
import { authService } from './authService';

type AuthContext = {
  userId: string;
  sessionId: string;
};

const ensureAuthContext = (): AuthContext => {
  const context = authService.getSession();
  if (!context?.user || !context.session) {
    const error = new Error(ERROR_MESSAGES.LOGIN_FAILED);
    (error as Error & { code?: string }).code = ERROR_CODES.UNAUTHORIZED;
    throw error;
  }

  return {
    userId: context.user.id,
    sessionId: context.session.id,
  };
};

const buildAuthHeaders = (contentType?: string): Record<string, string> => {
  const { userId, sessionId } = ensureAuthContext();
  const headers: Record<string, string> = {
    [SESSION_HEADERS.USER_ID]: userId,
    [SESSION_HEADERS.SESSION_ID]: sessionId,
    [HTTP_HEADERS.ACCEPT]: CONTENT_TYPES.JSON,
  };
  if (contentType) {
    headers[HTTP_HEADERS.CONTENT_TYPE] = contentType;
  }
  return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error((data as { message?: string })?.message ?? ERROR_MESSAGES.GENERIC_ERROR);
    (error as Error & { code?: string }).code =
      response.status === 401 ? ERROR_CODES.UNAUTHORIZED : ERROR_CODES.NETWORK_ERROR;
    throw error;
  }

  return data as T;
};

const resolveBaseUrl = (): string => {
  if (!API_CONFIG.BASE_URL) {
    throw new Error('API base URL is not configured');
  }

  return API_CONFIG.BASE_URL;
};

export const mediaService = {
  async listAudio(): Promise<AudioFile[]> {
    const baseUrl = resolveBaseUrl();
    const response = await fetch(`${baseUrl}/media/audio`, {
      method: HTTP_METHODS.GET,
      headers: buildAuthHeaders(),
    });

    const data = await handleResponse<AudioListResponse>(response);
    return data.items ?? [];
  },

  async uploadAudio(file: File): Promise<AudioFile> {
    const baseUrl = resolveBaseUrl();
    const formData = new FormData();
    formData.append('file', file, file.name);

    const response = await fetch(`${baseUrl}/media/audio`, {
      method: HTTP_METHODS.POST,
      headers: buildAuthHeaders(),
      body: formData,
    });

    const payload = await handleResponse<AudioUploadResponse>(response);
    return payload.item;
  },

  resolveStreamUrl(file: Pick<AudioFile, 'url'> | string): string {
    const baseUrl = resolveBaseUrl();
    const path = typeof file === 'string' ? file : file.url;
    const url = path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
    const { userId, sessionId } = ensureAuthContext();
    const urlObject = new URL(url);
    urlObject.searchParams.set('userId', userId);
    urlObject.searchParams.set('sessionId', sessionId);
    return urlObject.toString();
  },
};
