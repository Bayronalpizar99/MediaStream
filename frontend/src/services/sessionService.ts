import { API_CONFIG, HTTP_METHODS, HTTP_HEADERS, CONTENT_TYPES, ERROR_CODES, ERROR_MESSAGES, SESSION_HEADERS } from '../constants';
import { AuthSession } from '../models';
import { authService } from './authService';

type SessionListResponse = {
  message: string;
  sessions: AuthSession[];
};

type SessionResponse = {
  message: string;
  session: AuthSession;
};

const SESSION_ENDPOINTS = {
  HEARTBEAT: '/auth/sessions/heartbeat',
  LOGOUT: '/auth/logout',
  LIST: '/auth/sessions',
  TERMINATE: (sessionId: string) => `/auth/sessions/${sessionId}/terminate`,
} as const;

const ensureContext = () => {
  const context = authService.getSession();
  if (!context?.user || !context.session) {
    const error = new Error(ERROR_MESSAGES.LOGIN_FAILED);
    (error as any).code = ERROR_CODES.UNAUTHORIZED;
    throw error;
  }
  return context;
};

const buildAuthHeaders = (includeJson = false): Record<string, string> => {
  const { user, session } = ensureContext();
  const headers: Record<string, string> = {
    [SESSION_HEADERS.USER_ID]: user.id,
    [SESSION_HEADERS.SESSION_ID]: session.id,
  };

  if (includeJson) {
    headers[HTTP_HEADERS.CONTENT_TYPE] = CONTENT_TYPES.JSON;
  }

  return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || ERROR_MESSAGES.GENERIC_ERROR);
    (error as any).code = response.status === 401 ? ERROR_CODES.UNAUTHORIZED : ERROR_CODES.NETWORK_ERROR;
    throw error;
  }
  return data as T;
};

export const sessionService = {
  async heartbeat(): Promise<AuthSession> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${SESSION_ENDPOINTS.HEARTBEAT}`,
      {
        method: HTTP_METHODS.POST,
        headers: buildAuthHeaders(true),
        body: JSON.stringify({}),
      }
    );

    const data = await handleResponse<SessionResponse>(response);
    authService.updateSession(data.session);
    return data.session;
  },

  async logout(): Promise<void> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${SESSION_ENDPOINTS.LOGOUT}`,
      {
        method: HTTP_METHODS.POST,
        headers: buildAuthHeaders(true),
        body: JSON.stringify({}),
      }
    );

    await handleResponse<SessionResponse>(response);
  },

  async getSessions(): Promise<AuthSession[]> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${SESSION_ENDPOINTS.LIST}`,
      {
        method: HTTP_METHODS.GET,
        headers: {
          ...buildAuthHeaders(),
          [HTTP_HEADERS.ACCEPT]: CONTENT_TYPES.JSON,
        },
      }
    );

    const data = await handleResponse<SessionListResponse>(response);
    return data.sessions;
  },

  async terminateSession(sessionId: string): Promise<AuthSession> {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${SESSION_ENDPOINTS.TERMINATE(sessionId)}`,
      {
        method: HTTP_METHODS.POST,
        headers: buildAuthHeaders(true),
        body: JSON.stringify({}),
      }
    );

    const data = await handleResponse<SessionResponse>(response);
    return data.session;
  },
};
