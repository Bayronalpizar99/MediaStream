import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import {
  // 👇 CAMBIO: Usamos tus constantes de códigos de error
  HttpErrorStatusCodes,
  ERROR_MESSAGES,
  AUTH_ERROR_MESSAGES,
  JWT_SECRET_KEY // <-- CAMBIO: Importamos la clave desde constants
} from '../constants';

// Esta es la clave secreta de tu .env
const secret = new TextEncoder().encode(JWT_SECRET_KEY);

/**
 * Middleware de Express para verificar el token JWT.
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      // 👇 CAMBIO
      .status(HttpErrorStatusCodes.UNAUTHORIZED)
      .json({ message: ERROR_MESSAGES.UNAUTHORIZED });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res
      // 👇 CAMBIO
      .status(HttpErrorStatusCodes.UNAUTHORIZED)
      .json({ message: ERROR_MESSAGES.UNAUTHORIZED });
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    (req as any).user = payload;
    next();
  } catch (error) {
    return res
      // 👇 CAMBIO
      .status(HttpErrorStatusCodes.UNAUTHORIZED)
      .json({ message: AUTH_ERROR_MESSAGES.INVALID_TOKEN });
  }
};