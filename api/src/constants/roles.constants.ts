// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

// Default Role
export const DEFAULT_ROLE = USER_ROLES.USER;

// Security Policy: Role Assignment
export const ROLE_POLICY = {
  // New users always get 'user' role during registration
  REGISTRATION_DEFAULT: USER_ROLES.USER,
  // Only admins can change user roles via API
  ELEVATION_REQUIRES_ADMIN: true,
  // Admin role can only be assigned through database or admin API
  ADMIN_ASSIGNMENT_RESTRICTED: true,
} as const;

// Role Permissions
export const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: [
    'read_all_files',
    'write_all_files',
    'delete_all_files',
    'manage_users',
    'view_system_stats',
    'manage_nodes',
    'view_all_sessions',
  ],
  [USER_ROLES.USER]: [
    'read_own_files',
    'write_own_files',
    'delete_own_files',
    'view_own_sessions',
  ],
} as const;

// Permission Actions
export const PERMISSIONS = {
  // File permissions
  READ_ALL_FILES: 'read_all_files',
  WRITE_ALL_FILES: 'write_all_files',
  DELETE_ALL_FILES: 'delete_all_files',
  READ_OWN_FILES: 'read_own_files',
  WRITE_OWN_FILES: 'write_own_files',
  DELETE_OWN_FILES: 'delete_own_files',
  
  // User management
  MANAGE_USERS: 'manage_users',
  
  // System permissions
  VIEW_SYSTEM_STATS: 'view_system_stats',
  MANAGE_NODES: 'manage_nodes',
  
  // Session permissions
  VIEW_ALL_SESSIONS: 'view_all_sessions',
  VIEW_OWN_SESSIONS: 'view_own_sessions',
} as const;