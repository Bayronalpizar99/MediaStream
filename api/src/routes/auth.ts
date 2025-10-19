import { Router } from 'express';
import {
    ENV_VARIABLES,
    getEnvVar,
    AUTH_ERROR_MESSAGES,
    ERROR_MESSAGES,
    COLLECTIONS_NAMES,
    COLLECTIONS_FIELDS,
    AUTH_MESSAGES,
} from '../constants';
import db from '../config';
import {hashPassword} from "../security";



export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
    try {
    const {email, password, username } = req.body;
    if (!email) {
        return res.status(400).send({message: AUTH_ERROR_MESSAGES.EMAIL_IS_REQUIRED});
    } else if (!password) {
        return res.status(400).send({message: AUTH_ERROR_MESSAGES.PASSWORD_IS_REQUIRED});
    }

    const emailSnapshot = await db.db.collection(COLLECTIONS_NAMES.USERS).where(COLLECTIONS_FIELDS.EMAIL, '==', email).get();
    if (!emailSnapshot.empty) {
        return res.status(400).send({ message: AUTH_ERROR_MESSAGES.EMAIL_ALREADY_IN_USE });
    }

    const usernameSnapshot = await db.db.collection(COLLECTIONS_NAMES.USERS).where(COLLECTIONS_FIELDS.USERNAME, '==', username).get();
    if (!usernameSnapshot.empty) {
        return res.status(400).send({ message: AUTH_ERROR_MESSAGES.USERNAME_ALREADY_IN_USE });
    }


    const newPassword = await hashPassword(password)

    const userRef = await db.db.collection(COLLECTIONS_NAMES.USERS).add({
        email,
        password: newPassword,
        username,
        role: 'user',
        createdAt: new Date()
    });

    res.status(201).send({ message: AUTH_MESSAGES.USER_CRETED, id: userRef.id });

} catch (error) {
    console.error(error);
    res.status(500).send({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
}

});