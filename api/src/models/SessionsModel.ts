import { SESSION_STATUS } from '../constants';

export interface Session {
  id?: string;
  userId: string;
  role?: string;
  status: typeof SESSION_STATUS[keyof typeof SESSION_STATUS];
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
  terminatedAt?: Date | null;
}

export interface SessionResponse {
  id: string;
  userId: string;
  username?: string;
  email?: string;
  role?: string;
  status: typeof SESSION_STATUS[keyof typeof SESSION_STATUS];
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  terminatedAt?: string | null;
}
