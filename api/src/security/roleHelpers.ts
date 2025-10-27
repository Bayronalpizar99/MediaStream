import { USER_ROLES, ROLE_PERMISSIONS, PERMISSIONS } from '../constants';

/**
 * Check if a role has a specific permission
 */
export const hasPermission = (role: string, permission: string): boolean => {
    const rolePermissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
    return rolePermissions ? (rolePermissions as readonly string[]).includes(permission) : false;
};

/**
 * Check if user is admin
 */
export const isAdmin = (role: string): boolean => {
    return role === USER_ROLES.ADMIN;
};

/**
 * Check if user can manage other users
 */
export const canManageUsers = (role: string): boolean => {
    return hasPermission(role, PERMISSIONS.MANAGE_USERS);
};

/**
 * Check if user can access all files
 */
export const canAccessAllFiles = (role: string): boolean => {
    return hasPermission(role, PERMISSIONS.READ_ALL_FILES);
};

/**
 * Check if user can view system stats
 */
export const canViewSystemStats = (role: string): boolean => {
    return hasPermission(role, PERMISSIONS.VIEW_SYSTEM_STATS);
};

/**
 * Check if user can manage nodes
 */
export const canManageNodes = (role: string): boolean => {
    return hasPermission(role, PERMISSIONS.MANAGE_NODES);
};

/**
 * Get all permissions for a role
 */
export const getRolePermissions = (role: string): readonly string[] => {
    return ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || [];
};