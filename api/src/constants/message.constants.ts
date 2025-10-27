export const ERROR_MESSAGES = {
  NOT_FOUND: 'Not Found',
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
  UNHANDLED_ERROR: 'Unhandled Error',
  FORBIDDEN: 'Forbidden',
  UNAUTHORIZED: 'Unauthorized', // Lo usaremos para el token no proporcionado
  BAD_REQUEST: 'Bad Request',
};

export const AUTH_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_ALREADY_IN_USE: 'Email already in use',
  USERNAME_ALREADY_IN_USE: 'Username already in use',
  EMAIL_IS_REQUIRED: 'Email is required',
  PASSWORD_IS_REQUIRED: 'Password is required',
  INVALID_TOKEN: 'Token inválido o expirado.', // <-- AÑADE ESTE
};

export const AUTH_MESSAGES = {
  USER_CREATED: 'User created',
  USER_UPDATED: 'User updated',
  USER_LOGGED: 'User logged in',
}

// 👇 AÑADE ESTOS DOS NUEVOS OBJETOS
export const FILE_ERROR_MESSAGES = {
  NO_FILE_PROVIDED: 'No se ha proporcionado ningún archivo.',
};

export const FILE_MESSAGES = {
  UPLOAD_SUCCESS: 'Archivo subido exitosamente.',
};
