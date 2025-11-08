export const ERROR_MESSAGES = {
  NOT_FOUND: 'Not Found',
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
  UNHANDLED_ERROR: 'Unhandled Error',
  FORBIDDEN: 'Forbidden',
  UNAUTHORIZED: 'Unauthorized',
  BAD_REQUEST: 'Bad Request',
};

export const AUTH_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_ALREADY_IN_USE: 'Email already in use',
  USERNAME_ALREADY_IN_USE: 'Username already in use',
  EMAIL_IS_REQUIRED: 'Email is required',
  PASSWORD_IS_REQUIRED: 'Password is required',
  USERNAME_IS_REQUIRED: 'Username is required',
  ROLE_IS_INVALID: 'Invalid role provided',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions for this action',
};

export const AUTH_MESSAGES = {
  USER_CREATED: 'User created',
  USER_UPDATED: 'User updated',
  USER_LOGGED: 'User logged in',
  USER_LOGGED_OUT: 'User logged out',
};

export const SESSION_MESSAGES = {
  SESSION_CREATED: 'Session created',
  SESSION_EXTENDED: 'Session refreshed',
  SESSION_TERMINATED: 'Session terminated',
  SESSION_LIST_RETRIEVED: 'Active sessions retrieved',
};

export const SESSION_ERROR_MESSAGES = {
  SESSION_REQUIRED: 'Session is required',
  SESSION_NOT_FOUND: 'Session not found',
  SESSION_EXPIRED: 'Session has expired',
  SESSION_TERMINATED: 'Session has been terminated',
};
