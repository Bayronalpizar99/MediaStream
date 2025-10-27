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

export interface AuthResponse {
  message: string;
  userId?: string; // From login
  id?: string;     // From register
  user?: AuthUser;
}

export interface AuthError {
  message: string;
  code?: string;
}
