export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
}

export type SessionStatus = 'active' | 'idle' | 'expired' | 'terminated';

export interface AuthSession {
  id: string;
  userId: string;
  role?: string;
  username?: string;
  email?: string;
  status: SessionStatus;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  terminatedAt?: string | null;
}

export interface AuthResponse {
  message: string;
  userId?: string; // From login
  id?: string;     // From register
  user?: AuthUser;
  session?: AuthSession;
}

export interface AuthError {
  message: string;
  code?: string;
}
