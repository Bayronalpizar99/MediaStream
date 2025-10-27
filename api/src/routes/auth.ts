import { Router } from 'express';
import {
    AUTH_ERROR_MESSAGES,
    ERROR_MESSAGES,
    COLLECTIONS_NAMES,
    COLLECTIONS_FIELDS,
    AUTH_MESSAGES,
    HttpErrorStatusCodes,
    HttpSuccessStatusCodes,
    INDEXES,
    DEFAULT_ROLE,
    USER_ROLES,
    PERMISSIONS
} from '../constants/';
import db from '../config/';
import {hashPassword, verifyPassword, authenticateUser, requirePermission, requireAdmin} from "../security/";
import { CreateUserPayload } from '../models/UsersModel';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
    try {
    const {email, password, username } = req.body; // Removed role from destructuring
    if (!email) {
        return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({message: AUTH_ERROR_MESSAGES.EMAIL_IS_REQUIRED});
    } else if (!password) {
        return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({message: AUTH_ERROR_MESSAGES.PASSWORD_IS_REQUIRED});
    } else if (!username) {
        return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({message: AUTH_ERROR_MESSAGES.USERNAME_IS_REQUIRED});
    }

    // Role is always 'user' by default - cannot be set during registration
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

    const userRef = await db.db.collection(COLLECTIONS_NAMES.USERS).add({
        email,
        password: newPassword,
        username,
        role: userRole,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
    });

    res.status(HttpSuccessStatusCodes.CREATED).send({ 
        message: AUTH_MESSAGES.USER_CREATED, 
        id: userRef.id,
        user: {
            id: userRef.id,
            email,
            username,
            role: userRole
        }
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

        res.status(HttpSuccessStatusCodes.OK).send({ 
            message: AUTH_MESSAGES.USER_LOGGED, 
            userId: userDoc.id,
            user: {
                id: userDoc.id,
                email: userData.email,
                username: userData.username,
                role: userData.role
            }
        });

    } catch (error) {
        console.error(error);
        res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
    }
})

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