import { USER_ROLES } from '../constants';

export interface User {
  id?: string;
  email: string;
  username: string;
  password: string;
  role: typeof USER_ROLES[keyof typeof USER_ROLES];
  createdAt?: Date;
  updatedAt?: Date;
  isActive?: boolean;
}

export interface CreateUserPayload {
  email: string;
  username: string;
  password: string;
  // Note: role is not included - always defaults to 'user'
}

export interface UpdateUserPayload {
  email?: string;
  username?: string;
  role?: typeof USER_ROLES[keyof typeof USER_ROLES];
  isActive?: boolean;
}

export interface UserResponse {
  id: string;
  email: string;
  username: string;
  role: typeof USER_ROLES[keyof typeof USER_ROLES];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}