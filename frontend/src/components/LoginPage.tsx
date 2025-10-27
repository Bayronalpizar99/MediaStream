import { useState } from 'react';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { authService } from '../services/authService';
import { Loader2, Music, Video, Radio, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { ERROR_MESSAGES, APP_CONFIG } from '../constants';
import { AuthUser } from '../models';

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [formType, setFormType] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register state
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');

  const switchForm = (type: 'login' | 'register') => {
    setFormType(type);
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await authService.login({
        email: loginEmail,
        password: loginPassword,
      });

      const apiUser = response.user;
      const user: AuthUser = apiUser ?? {
        email: loginEmail,
        username: loginEmail.split('@')[0],
        id: response.userId ?? '',
        role: 'user',
      };
      authService.saveSession(user);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || ERROR_MESSAGES.LOGIN_FAILED);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (registerPassword !== registerConfirmPassword) {
      setError(ERROR_MESSAGES.PASSWORDS_DO_NOT_MATCH);
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.register({
        email: registerEmail,
        username: registerUsername,
        password: registerPassword,
      });

      const apiUser = response.user;
      const user: AuthUser = apiUser ?? {
        email: registerEmail,
        username: registerUsername,
        id: response.id ?? '',
        role: 'user',
      };
      authService.saveSession(user);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || ERROR_MESSAGES.REGISTRATION_FAILED);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-2 mb-4">
            <Music className="w-8 h-8 text-purple-400" />
            <Video className="w-8 h-8 text-blue-400" />
            <Radio className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-white text-4xl mb-2">{APP_CONFIG.NAME}</h1>
          <p className="text-gray-300">{APP_CONFIG.DESCRIPTION}</p>
        </div>

        <Card>
          {formType === 'login' ? (
            <>
              <CardHeader>
                <CardTitle>Iniciar Sesión</CardTitle>
                <CardDescription>
                  Accede a tu cuenta para continuar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Correo</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      'Iniciar Sesión'
                    )}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="text-center text-sm justify-center">
                <p>
                  ¿No tienes una cuenta?{' '}
                  <Button variant="link" className="p-0 h-auto" onClick={() => switchForm('register')}>
                    Regístrate
                  </Button>
                </p>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Registrarse</CardTitle>
                <CardDescription>
                  Crea una cuenta para empezar a usar nuestros servicios.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Correo</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Usuario</Label>
                    <Input
                      id="register-username"
                      type="text"
                      placeholder="tu_usuario"
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Contraseña</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm-password">
                      Confirmar Contraseña
                    </Label>
                    <Input
                      id="register-confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      'Registrarse'
                    )}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="text-center text-sm justify-center">
                <p>
                  ¿Ya tienes una cuenta?{' '}
                  <Button variant="link" className="p-0 h-auto" onClick={() => switchForm('login')}>
                    Inicia Sesión
                  </Button>
                </p>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
