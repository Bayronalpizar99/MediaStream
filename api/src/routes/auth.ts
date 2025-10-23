import { Router } from 'express';
import {
    ENV_VARIABLES,
    getEnvVar,
    AUTH_ERROR_MESSAGES,
    ERROR_MESSAGES,
    COLLECTIONS_NAMES,
    COLLECTIONS_FIELDS,
    AUTH_MESSAGES,
    HttpErrorStatusCodes,
    HttpSuccessStatusCodes,
    INDEXES
} from '../constants/';
import db from '../config/';
import {hashPassword, verifyPassword} from "../security/";

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
    try {
    const {email, password, username } = req.body;
    if (!email) {
        return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({message: AUTH_ERROR_MESSAGES.EMAIL_IS_REQUIRED});
    } else if (!password) {
        return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({message: AUTH_ERROR_MESSAGES.PASSWORD_IS_REQUIRED});
    }

    const emailSnapshot = await db.db.collection(COLLECTIONS_NAMES.USERS).where(COLLECTIONS_FIELDS.EMAIL, '==', email).get();
    if (!emailSnapshot.empty) {
        return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: AUTH_ERROR_MESSAGES.EMAIL_ALREADY_IN_USE });
    }

    const usernameSnapshot = await db.db.collection(COLLECTIONS_NAMES.USERS).where(COLLECTIONS_FIELDS.USERNAME, '==', username).get();
    if (!usernameSnapshot.empty) {
        return res.status(HttpErrorStatusCodes.BAD_REQUEST).send({ message: AUTH_ERROR_MESSAGES.USERNAME_ALREADY_IN_USE });
    }


    const newPassword = await hashPassword(password)

    const userRef = await db.db.collection(COLLECTIONS_NAMES.USERS).add({
        email,
        password: newPassword,
        username,
        role: 'user',
        createdAt: new Date()
    });

    res.status(HttpSuccessStatusCodes.CREATED).send({ message: AUTH_MESSAGES.USER_CREATED, id: userRef.id });

} catch (error) {
    console.error(error);
    res.status(HttpErrorStatusCodes.INTERNAL_SERVER_ERROR).send({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
}

});


authRouter.post('/login', async (req, res) => {
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


    const isMatch = await verifyPassword(password, userData.password);

    if (!isMatch) {
        return res.status(HttpErrorStatusCodes.FORBIDDEN).send({ message: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS });
    }

    res.status(HttpSuccessStatusCodes.OK).send({ message: AUTH_MESSAGES.USER_LOGGED, userId: userDoc.id });

})