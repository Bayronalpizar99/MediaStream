import { LoginPayload, RegisterPayload, AuthResponse, AuthError } from '../models';
import { 
  API_CONFIG, 
  HTTP_METHODS, 
  HTTP_HEADERS, 
  CONTENT_TYPES, 
  ERROR_CODES, 
  ERROR_MESSAGES,
  STORAGE_KEYS 
} from '../constants';



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
  saveSession(user: { email: string; username: string; id: string }) {
    const session = { user, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  },

  /**
   * Get user session from localStorage
   */
  getSession(): { user: { email: string; username: string; id: string } } | null {
    const session = localStorage.getItem(STORAGE_KEYS.SESSION);
    return session ? JSON.parse(session) : null;
  },

  /**
   * Clear user session
   */
  clearSession() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  },
};
