import { LoginPayload, RegisterPayload, AuthResponse, AuthError, AuthUser, AuthSession } from '../models';
import { 
  API_CONFIG, 
  HTTP_METHODS, 
  HTTP_HEADERS, 
  CONTENT_TYPES, 
  ERROR_CODES, 
  ERROR_MESSAGES,
  STORAGE_KEYS,
  SESSION_HEADERS // <-- AÑADIDO
} from '../constants';



type StoredSession = {
  user: AuthUser;
  session: AuthSession | null;
  timestamp: number;
};

export const authService = {
  /**
   * Login endpoint
   */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.LOGIN}`, {
        method: HTTP_METHODS.POST,
        headers: {
          [HTTP_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Error ${response.status}`);
      }

      return data;
    } catch (error) {
      throw {
        message: error instanceof Error ? error.message : ERROR_MESSAGES.LOGIN_FAILED,
        code: ERROR_CODES.LOGIN_ERROR,
      } as AuthError;
    }
  },

  /**
   * Register endpoint
   */
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.REGISTER}`, {
        method: HTTP_METHODS.POST,
        headers: {
          [HTTP_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Error ${response.status}`);
      }

      return data;
    } catch (error) {
      throw {
        message: error instanceof Error ? error.message : ERROR_MESSAGES.REGISTRATION_FAILED,
        code: ERROR_CODES.REGISTER_ERROR,
      } as AuthError;
    }
  },

  /**
   * Save user session to localStorage
   */
  saveSession(user: AuthUser, session?: AuthSession | null) {
    const payload: StoredSession = { user, session: session ?? null, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(payload));
  },

  /**
   * Get user session from localStorage
   */
  getSession(): StoredSession | null {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as StoredSession;
      if (!parsed.user) {
        return null;
      }
      return parsed;
    } catch (error) {
      console.error('Failed to parse stored session:', error);
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      return null;
    }
  },

  /**
   * Update stored session details
   */
  updateSession(session: AuthSession) {
    const current = this.getSession();
    if (!current) {
      return;
    }

    const payload: StoredSession = {
      ...current,
      session,
      timestamp: Date.now(),
    };

    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(payload));
  },

  /**
   * Clear user session
   */
  clearSession() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  },

  /**
   * Returns whether a session is currently stored
   */
  hasActiveSession(): boolean {
    const current = this.getSession();
    return Boolean(current?.user && current.session);
  },

  // 👇 --- FUNCIÓN AÑADIDA --- 👇
  /**
   * Get session authorization headers for API requests
   */
  getSessionHeaders(): Record<string, string> {
    const storedSession = this.getSession();

    if (!storedSession?.user?.id || !storedSession?.session?.id) {
      console.warn('No session data found for auth headers');
      return {}; // Retorna objeto vacío si no hay sesión
    }

    return {
      [SESSION_HEADERS.USER_ID]: storedSession.user.id,
      [SESSION_HEADERS.SESSION_ID]: storedSession.session.id,
    };
  },
  // 👆 --- FIN DE LA FUNCIÓN AÑADIDA --- 👆
};