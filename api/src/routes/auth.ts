import { Router, Request } from 'express';
import {
    AUTH_ERROR_MESSAGES,
    ERROR_MESSAGES,
    COLLECTIONS_NAMES,
    COLLECTIONS_FIELDS,
    AUTH_MESSAGES,
    SESSION_MESSAGES,
    SESSION_ERROR_MESSAGES,
    HttpErrorStatusCodes,
    HttpSuccessStatusCodes,
    INDEXES,
    DEFAULT_ROLE,
    USER_ROLES,
    SESSION_STATUS,
    SESSION_TIMEOUTS
} from '../constants/';
import db from '../config/';
import {hashPassword, verifyPassword, authenticateUser, requireAdmin} from "../security/";
import { CreateUserPayload } from '../models/UsersModel';
import { SessionResponse } from '../models/SessionsModel';
import type { WriteResult } from 'firebase-admin/firestore';

export const authRouter = Router();

const SESSION_IDLE_TIMEOUT_MS = SESSION_TIMEOUTS.IDLE_MINUTES * 60 * 1000;
const SESSION_MAX_DURATION_MS = SESSION_TIMEOUTS.MAX_DURATION_HOURS * 60 * 60 * 1000;

const normalizeHeaderValue = (value: string | string[] | undefined): string | null => {
    if (!value) {
        return null;
    }
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }
    return value;
};

const getClientIp = (req: Request): string | null => {
    const forwarded = req.headers['x-forwarded-for'];
    const normalizedForwarded = normalizeHeaderValue(forwarded);
    if (normalizedForwarded) {
        return normalizedForwarded.split(',')[0]?.trim() ?? null;
    }

    const socketIp = req.socket?.remoteAddress;
    return socketIp ?? null;
};

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

const createSessionForUser = async (
    req: Request,
    user: { id: string; email: string; username: string; role?: string; }
): Promise<SessionResponse> => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_IDLE_TIMEOUT_MS);
    const userAgentHeader = req.headers['user-agent'];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader.join(', ') : userAgentHeader ?? null;
    const ipAddress = getClientIp(req);

    const sessionPayload = {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role ?? null,
        status: SESSION_STATUS.ACTIVE,
        createdAt: now,
        lastActivity: now,
        expiresAt,
        userAgent,
        ipAddress,
        terminatedAt: null,
        maxDurationMs: SESSION_MAX_DURATION_MS,
    };

    const sessionRef = await db.db.collection(COLLECTIONS_NAMES.SESSIONS).add(sessionPayload);

    return {
        id: sessionRef.id,
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: SESSION_STATUS.ACTIVE,
        createdAt: now.toISOString(),
        lastActivity: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        userAgent,
        ipAddress,
        terminatedAt: null,
    };
};

const serializeSession = (
    sessionId: string,
    sessionData: any,
    overrides: Partial<{
        status: typeof SESSION_STATUS[keyof typeof SESSION_STATUS];
        lastActivity: Date;
        expiresAt: Date;
        terminatedAt: Date | null;
    }> = {}
): SessionResponse => {
    const createdAt = toDate(sessionData.createdAt);
    const lastActivity = overrides.lastActivity ?? toDate(sessionData.lastActivity || createdAt);
    const expiresAt = overrides.expiresAt ?? toDate(sessionData.expiresAt || lastActivity);
    const terminatedAt = overrides.terminatedAt ?? (sessionData.terminatedAt ? toDate(sessionData.terminatedAt) : null);
    const status = overrides.status ?? sessionData.status;

    return {
        id: sessionId,
        userId: sessionData.userId,
        email: sessionData.email,
        username: sessionData.username,
        role: sessionData.role ?? null,
        status,
        createdAt: createdAt.toISOString(),
        lastActivity: lastActivity.toISOString(),
        expiresAt: expiresAt.toISOString(),
        userAgent: sessionData.userAgent ?? null,
        ipAddress: sessionData.ipAddress ?? null,
        terminatedAt: terminatedAt ? terminatedAt.toISOString() : null,
    };
};

const resolveSessionStatus = (
    sessionData: any,
    now: Date
): typeof SESSION_STATUS[keyof typeof SESSION_STATUS] => {
    if (sessionData.status === SESSION_STATUS.TERMINATED) {
        return SESSION_STATUS.TERMINATED;
    }

    const createdAt = toDate(sessionData.createdAt || now);
    const lastActivity = toDate(sessionData.lastActivity || createdAt);
    const expiresAt = toDate(sessionData.expiresAt || lastActivity);

    if (sessionData.status === SESSION_STATUS.EXPIRED || now > expiresAt) {
        return SESSION_STATUS.EXPIRED;
    }

    if (SESSION_MAX_DURATION_MS > 0 && now.getTime() - createdAt.getTime() > SESSION_MAX_DURATION_MS) {
        return SESSION_STATUS.EXPIRED;
    }

    const idleMs = now.getTime() - lastActivity.getTime();
    const idleThreshold = Math.max(SESSION_IDLE_TIMEOUT_MS / 2, 60_000);

    if (idleMs >= SESSION_IDLE_TIMEOUT_MS) {
        return SESSION_STATUS.EXPIRED;
    }

    if (idleMs >= idleThreshold) {
        return SESSION_STATUS.IDLE;
    }

    return SESSION_STATUS.ACTIVE;
};

authRouter.post('/register', async (req, res) => {
    try {
        const { email, password, username } = req.body as CreateUserPayload;
        if (!email) {
            return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: AUTH_ERROR_MESSAGES.EMAIL_IS_REQUIRED });
        } else if (!password) {
            return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: AUTH_ERROR_MESSAGES.PASSWORD_IS_REQUIRED });
        } else if (!username) {
            return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: AUTH_ERROR_MESSAGES.USERNAME_IS_REQUIRED });
        }

        const userRole = DEFAULT_ROLE;

        const emailSnapshot = await db.db.collection(COLLECTIONS_NAMES.USERS).where(COLLECTIONS_FIELDS.EMAIL, '==', email).get();
        if (!emailSnapshot.empty) {
            return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: AUTH_ERROR_MESSAGES.EMAIL_ALREADY_IN_USE });
        }

        const usernameSnapshot = await db.db.collection(COLLECTIONS_NAMES.USERS).where(COLLECTIONS_FIELDS.USERNAME, '==', username).get();
        if (!usernameSnapshot.empty) {
            return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: AUTH_ERROR_MESSAGES.USERNAME_ALREADY_IN_USE });
        }

        const newPassword = await hashPassword(password);
        const now = new Date();

        const userRef = await db.db.collection(COLLECTIONS_NAMES.USERS).add({
            email,
            password: newPassword,
            username,
            role: userRole,
            createdAt: now,
            updatedAt: now,
            isActive: true
        });

        const session = await createSessionForUser(req, {
            id: userRef.id,
            email,
            username,
            role: userRole
        });

        res.status(HttpSuccessStatusCodes.CREATED).send({
            message: AUTH_MESSAGES.USER_CREATED,
            id: userRef.id,
            user: {
                id: userRef.id,
                email,
                username,
                role: userRole
            },
            session
        });
    } catch (error) {
        console.error(error);
        res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
    }
});


authRouter.post('/login', async (req, res) => {
    try {
        const {email, password} = req.body;
        if (!email) {
            return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({message:AUTH_ERROR_MESSAGES.EMAIL_IS_REQUIRED});
        } else if (!password) {
            return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({message:AUTH_ERROR_MESSAGES.PASSWORD_IS_REQUIRED});
        }

        const userSnapshot = await  db.db.collection(COLLECTIONS_NAMES.USERS).
        where(COLLECTIONS_FIELDS.EMAIL, '==', email).
        get();

        if (userSnapshot.empty) {
            return res.status(HttpErrorStatusCodes.NOT_FOUND).send({message: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS})
        }

        const userDoc = userSnapshot.docs[INDEXES.ZERO];
        const userData = userDoc.data();

        // Check if user is active
        if (userData.isActive === false) {
            return res.status(HttpErrorStatusCodes.FORBIDDEN).send({ message: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS });
        }

        const isMatch = await verifyPassword(password, userData.password);

        if (!isMatch) {
            return res.status(HttpErrorStatusCodes.FORBIDDEN).send({ message: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS });
        }

        const session = await createSessionForUser(req, {
            id: userDoc.id,
            email: userData.email,
            username: userData.username,
            role: userData.role
        });

        res.status(HttpSuccessStatusCodes.OK).send({ 
            message: AUTH_MESSAGES.USER_LOGGED, 
            userId: userDoc.id,
            user: {
                id: userDoc.id,
                email: userData.email,
                username: userData.username,
                role: userData.role
            },
            session
        });

    } catch (error) {
        console.error(error);
        res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
    }
});

authRouter.post('/logout', authenticateUser, async (req, res) => {
    try {
        const sessionId = req.session?.id;
        if (!sessionId) {
            return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({
                message: SESSION_ERROR_MESSAGES.SESSION_REQUIRED
            });
        }

        const sessionRef = db.db.collection(COLLECTIONS_NAMES.SESSIONS).doc(sessionId);
        const sessionDoc = await sessionRef.get();

        if (!sessionDoc.exists) {
            return res.status(HttpErrorStatusCodes.NOT_FOUND).send({
                message: SESSION_ERROR_MESSAGES.SESSION_NOT_FOUND
            });
        }

        const now = new Date();
        await sessionRef.update({
            status: SESSION_STATUS.TERMINATED,
            terminatedAt: now
        });

        const sessionData = sessionDoc.data();
        const sessionResponse = serializeSession(sessionDoc.id, sessionData, {
            status: SESSION_STATUS.TERMINATED,
            terminatedAt: now
        });

        res.status(HttpSuccessStatusCodes.OK).send({
            message: AUTH_MESSAGES.USER_LOGGED_OUT,
            session: sessionResponse
        });
    } catch (error) {
        console.error(error);
        res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
    }
});

authRouter.post('/sessions/heartbeat', authenticateUser, async (req, res) => {
    try {
        const sessionId = req.session?.id;
        if (!sessionId) {
            return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({
                message: SESSION_ERROR_MESSAGES.SESSION_REQUIRED
            });
        }

        const sessionRef = db.db.collection(COLLECTIONS_NAMES.SESSIONS).doc(sessionId);
        const sessionDoc = await sessionRef.get();

        if (!sessionDoc.exists) {
            return res.status(HttpErrorStatusCodes.NOT_FOUND).send({
                message: SESSION_ERROR_MESSAGES.SESSION_NOT_FOUND
            });
        }

        const sessionData = sessionDoc.data();
        const sessionResponse = serializeSession(sessionDoc.id, sessionData, {
            status: SESSION_STATUS.ACTIVE,
            lastActivity: req.session?.lastActivity,
            expiresAt: req.session?.expiresAt
        });

        res.status(HttpSuccessStatusCodes.OK).send({
            message: SESSION_MESSAGES.SESSION_EXTENDED,
            session: sessionResponse
        });
    } catch (error) {
        console.error(error);
        res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
    }
});

// Get current user profile
authRouter.get('/profile', authenticateUser, async (req, res) => {
    try {
        res.status(HttpSuccessStatusCodes.OK).send({
            message: 'User profile retrieved',
            user: req.user
        });
    } catch (error) {
        console.error(error);
        res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
    }
});

// Get all users (admin only)
authRouter.get('/users', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const usersSnapshot = await db.db.collection(COLLECTIONS_NAMES.USERS).get();
        const users = usersSnapshot.docs.map(doc => {
            const userData = doc.data();
            return {
                id: doc.id,
                email: userData.email,
                username: userData.username,
                role: userData.role,
                isActive: userData.isActive,
                createdAt: userData.createdAt
            };
        });

        res.status(HttpSuccessStatusCodes.OK).send({
            message: 'Users retrieved successfully',
            users
        });
    } catch (error) {
        console.error(error);
        res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
    }
});

// Update user role (admin only)
// This is the ONLY way to change user privileges from 'user' to 'admin'
// Role cannot be set during registration - always defaults to 'user'
authRouter.patch('/users/:userId/role', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!role || !Object.values(USER_ROLES).includes(role)) {
            return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({
                message: AUTH_ERROR_MESSAGES.ROLE_IS_INVALID
            });
        }

        const userRef = db.db.collection(COLLECTIONS_NAMES.USERS).doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(HttpErrorStatusCodes.NOT_FOUND).send({
                message: 'User not found'
            });
        }

        await userRef.update({
            role,
            updatedAt: new Date()
        });

        res.status(HttpSuccessStatusCodes.OK).send({
            message: 'User role updated successfully',
            userId,
            newRole: role
        });
    } catch (error) {
        console.error(error);
        res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
    }
});

authRouter.get('/sessions', authenticateUser, requireAdmin, async (_req, res) => {
    try {
        const sessionsSnapshot = await db.db.collection(COLLECTIONS_NAMES.SESSIONS).get();
        const now = new Date();
        const updates: Promise<WriteResult>[] = [];

        const sessions = sessionsSnapshot.docs.map(doc => {
            const sessionData = doc.data();
            const computedStatus = resolveSessionStatus(sessionData, now);
            if (
                computedStatus === SESSION_STATUS.EXPIRED &&
                sessionData.status !== SESSION_STATUS.EXPIRED
            ) {
                updates.push(doc.ref.update({
                    status: SESSION_STATUS.EXPIRED,
                    terminatedAt: now
                }));
            }

            return serializeSession(doc.id, sessionData, {
                status: computedStatus,
                terminatedAt: computedStatus === SESSION_STATUS.EXPIRED
                    ? sessionData.terminatedAt ? toDate(sessionData.terminatedAt) : now
                    : sessionData.terminatedAt ? toDate(sessionData.terminatedAt) : null
            });
        });

        if (updates.length > 0) {
            await Promise.all(updates);
        }

        res.status(HttpSuccessStatusCodes.OK).send({
            message: SESSION_MESSAGES.SESSION_LIST_RETRIEVED,
            sessions
        });
    } catch (error) {
        console.error(error);
        res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
    }
});

authRouter.post('/sessions/:sessionId/terminate', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const sessionRef = db.db.collection(COLLECTIONS_NAMES.SESSIONS).doc(sessionId);
        const sessionDoc = await sessionRef.get();

        if (!sessionDoc.exists) {
            return res.status(HttpErrorStatusCodes.NOT_FOUND).send({
                message: SESSION_ERROR_MESSAGES.SESSION_NOT_FOUND
            });
        }

        const now = new Date();
        await sessionRef.update({
            status: SESSION_STATUS.TERMINATED,
            terminatedAt: now
        });

        const sessionData = sessionDoc.data();
        const sessionResponse = serializeSession(sessionDoc.id, sessionData, {
            status: SESSION_STATUS.TERMINATED,
            terminatedAt: now
        });

        res.status(HttpSuccessStatusCodes.OK).send({
            message: SESSION_MESSAGES.SESSION_TERMINATED,
            session: sessionResponse
        });
    } catch (error) {
        console.error(error);
        res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
    }
});
