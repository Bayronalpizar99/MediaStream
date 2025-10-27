import { Request, Response, NextFunction } from 'express';
import { 
    USER_ROLES, 
    ROLE_PERMISSIONS, 
    AUTH_ERROR_MESSAGES, 
    HttpErrorStatusCodes,
    COLLECTIONS_NAMES,
    COLLECTIONS_FIELDS,
    INDEXES
} from '../constants';
import db from '../config';

// Extend Request interface to include user data
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                username: string;
                role: string;
            };
        }
    }
}

/**
 * Middleware to verify if user has required role
 */
export const requireRole = (requiredRole: keyof typeof USER_ROLES) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = req.user?.role;
        
        if (!userRole) {
            return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({
                message: AUTH_ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS
            });
        }

        if (userRole !== USER_ROLES[requiredRole]) {
            return res.status(HttpErrorStatusCodes.FORBIDDEN).send({
                message: AUTH_ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS
            });
        }

        next();
    };
};

/**
 * Middleware to verify if user has required permission
 */
export const requirePermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = req.user?.role as keyof typeof ROLE_PERMISSIONS;
        
        if (!userRole) {
            return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({
                message: AUTH_ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS
            });
        }

        const rolePermissions = ROLE_PERMISSIONS[userRole];
        
        if (!rolePermissions || !(rolePermissions as readonly string[]).includes(permission)) {
            return res.status(HttpErrorStatusCodes.FORBIDDEN).send({
                message: AUTH_ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS
            });
        }

        next();
    };
};

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Middleware to verify user ownership of resource or admin role
 */
export const requireOwnershipOrAdmin = (resourceUserIdField: string = 'userId') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const currentUserId = req.user?.id;
        const currentUserRole = req.user?.role;
        const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];

        if (!currentUserId) {
            return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({
                message: AUTH_ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS
            });
        }

        // Admin can access any resource
        if (currentUserRole === USER_ROLES.ADMIN) {
            return next();
        }

        // User can only access their own resources
        if (currentUserId === resourceUserId) {
            return next();
        }

        return res.status(HttpErrorStatusCodes.FORBIDDEN).send({
            message: AUTH_ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS
        });
    };
};

/**
 * Middleware to authenticate user (extract user info from token/session)
 * This is a basic implementation - in production you'd use JWT or similar
 */
export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // For now, we'll get user ID from headers (in production, use JWT)
        const userId = req.headers['x-user-id'] as string;
        
        if (!userId) {
            return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({
                message: AUTH_ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS
            });
        }

        // Get user data from database
        const userDoc = await db.db.collection(COLLECTIONS_NAMES.USERS).doc(userId).get();
        
        if (!userDoc.exists) {
            return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({
                message: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS
            });
        }

        const userData = userDoc.data();
        
        if (!userData || userData.isActive === false) {
            return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({
                message: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS
            });
        }

        // Attach user data to request
        req.user = {
            id: userDoc.id,
            email: userData.email,
            username: userData.username,
            role: userData.role
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({
            message: 'Authentication failed'
        });
    }
};