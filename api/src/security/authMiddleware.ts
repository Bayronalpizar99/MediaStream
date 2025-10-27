import { Request, Response, NextFunction } from 'express';
import { 
    USER_ROLES, 
    ROLE_PERMISSIONS, 
    AUTH_ERROR_MESSAGES,
    SESSION_ERROR_MESSAGES,
    SESSION_HEADERS,
    SESSION_TIMEOUTS,
    SESSION_STATUS,
    HttpErrorStatusCodes,
    COLLECTIONS_NAMES
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
            session?: {
                id: string;
                status: typeof SESSION_STATUS[keyof typeof SESSION_STATUS];
                lastActivity: Date;
                expiresAt: Date;
                createdAt: Date;
                ipAddress?: string | null;
                userAgent?: string | null;
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
        const userId = req.headers[SESSION_HEADERS.USER_ID] as string;
        const sessionId = req.headers[SESSION_HEADERS.SESSION_ID] as string;

        if (!userId || !sessionId) {
            return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({
                message: SESSION_ERROR_MESSAGES.SESSION_REQUIRED
            });
        }

        const sessionRef = db.db.collection(COLLECTIONS_NAMES.SESSIONS).doc(sessionId);
        const sessionDoc = await sessionRef.get();

        if (!sessionDoc.exists) {
            return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({
                message: SESSION_ERROR_MESSAGES.SESSION_NOT_FOUND
            });
        }

        const sessionData = sessionDoc.data();

        if (!sessionData || sessionData.userId !== userId) {
            return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({
                message: SESSION_ERROR_MESSAGES.SESSION_NOT_FOUND
            });
        }

        if (sessionData.status === SESSION_STATUS.TERMINATED) {
            return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({
                message: SESSION_ERROR_MESSAGES.SESSION_TERMINATED
            });
        }

        const toDate = (value: any): Date => {
            if (!value) {
                return new Date(0);
            }
            if (value instanceof Date) {
                return value;
            }
            if (typeof value.toDate === 'function') {
                return value.toDate();
            }
            return new Date(value);
        };

        const now = new Date();
        const lastActivity = toDate(sessionData.lastActivity || sessionData.createdAt || now);
        const expiresAt = toDate(sessionData.expiresAt || now);
        const idleTimeoutMs = SESSION_TIMEOUTS.IDLE_MINUTES * 60 * 1000;
        const maxDurationMs = SESSION_TIMEOUTS.MAX_DURATION_HOURS * 60 * 60 * 1000;
        const createdAt = toDate(sessionData.createdAt || now);

        if (sessionData.status === SESSION_STATUS.EXPIRED || now > expiresAt) {
            await sessionRef.update({
                status: SESSION_STATUS.EXPIRED,
                terminatedAt: now
            });
            return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({
                message: SESSION_ERROR_MESSAGES.SESSION_EXPIRED
            });
        }

        if (now.getTime() - lastActivity.getTime() > idleTimeoutMs) {
            await sessionRef.update({
                status: SESSION_STATUS.EXPIRED,
                terminatedAt: now
            });
            return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({
                message: SESSION_ERROR_MESSAGES.SESSION_EXPIRED
            });
        }

        if (now.getTime() - createdAt.getTime() > maxDurationMs) {
            await sessionRef.update({
                status: SESSION_STATUS.EXPIRED,
                terminatedAt: now
            });
            return res.status(HttpErrorStatusCodes.UNAUTHORIZED).send({
                message: SESSION_ERROR_MESSAGES.SESSION_EXPIRED
            });
        }

        // Refresh session timers
        const newExpiresAt = new Date(now.getTime() + idleTimeoutMs);
        await sessionRef.update({
            lastActivity: now,
            expiresAt: newExpiresAt,
            status: SESSION_STATUS.ACTIVE
        });

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

        req.session = {
            id: sessionId,
            status: SESSION_STATUS.ACTIVE,
            lastActivity: now,
            expiresAt: newExpiresAt,
            createdAt,
            ipAddress: sessionData.ipAddress ?? null,
            userAgent: sessionData.userAgent ?? null
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({
            message: 'Authentication failed'
        });
    }
};
