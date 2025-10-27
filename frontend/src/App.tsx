import { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { MediaPlayer } from './components/MediaPlayer';
import { FileConverter } from './components/FileConverter';
import { FileSharing } from './components/FileSharing';
import { NodeMonitor } from './components/NodeMonitor';
import { UserSessions } from './components/UserSessions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Button } from './components/ui/button';
import { Music, Video, RefreshCw, Share2, Server, Users, LogOut } from 'lucide-react';
import { authService } from './services/authService';
import { sessionService } from './services/sessionService';
import { AuthUser, AuthSession, SessionStatus } from './models';
import { SESSION_DEFAULTS } from './constants';

const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  active: 'Activa',
  idle: 'En reposo',
  expired: 'Expirada',
  terminated: 'Terminada',
};

const formatSessionStatus = (status?: SessionStatus) => {
  if (!status) {
    return '';
  }
  return SESSION_STATUS_LABELS[status] ?? status;
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [currentSession, setCurrentSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSessionState = () => {
    authService.clearSession();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentSession(null);
  };

  // Restore session on mount
  useEffect(() => {
    const stored = authService.getSession();
    if (stored?.user && stored.session) {
      const storedUser: AuthUser = {
        ...stored.user,
        role: stored.user.role ?? 'user',
      };
      const storedSession: AuthSession = {
        ...stored.session,
        role: stored.session.role ?? storedUser.role,
        username: stored.session.username ?? storedUser.username,
        email: stored.session.email ?? storedUser.email,
      };
      setCurrentUser(storedUser);
      setCurrentSession(storedSession);
      setIsLoggedIn(true);
    } else if (stored?.user) {
      authService.clearSession();
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !currentSession) {
      return;
    }

    let cancelled = false;

    const refreshSession = async (notify: boolean) => {
      try {
        const updatedSession = await sessionService.heartbeat();
        if (!cancelled) {
          setCurrentSession({
            ...updatedSession,
            role: updatedSession.role ?? currentUser?.role,
            username: updatedSession.username ?? currentUser?.username,
            email: updatedSession.email ?? currentUser?.email,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Heartbeat error:', error);
          if (notify) {
            window.alert('Tu sesión ha expirado por inactividad.');
          }
          clearSessionState();
        }
      }
    };

    void refreshSession(false);

    const intervalId = window.setInterval(() => {
      void refreshSession(true);
    }, SESSION_DEFAULTS.HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isLoggedIn, currentSession?.id, currentUser?.role, currentUser?.username, currentUser?.email]);

  const handleLogin = (user: AuthUser, session: AuthSession) => {
    setCurrentUser(user);
    setCurrentSession(session);
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      if (currentSession) {
        await sessionService.logout();
      }
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      clearSessionState();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Music className="w-8 h-8 text-purple-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Music className="w-6 h-6 text-purple-600" />
                <Video className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl">MediaStream</h1>
                <p className="text-sm text-gray-500">Sistema Multimedia Distribuido</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm">Bienvenido,</p>
                <p>{currentUser?.username || currentUser?.email}</p>
                {currentUser?.role && (
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    Rol: {currentUser.role}
                  </span>
                )}
                {currentSession && (
                  <p className="mt-1 text-xs text-gray-500">
                    Sesión {formatSessionStatus(currentSession.status)} · expira a las {new Date(currentSession.expiresAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={() => void handleLogout()}>
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${isAdmin ? 'border-purple-200 bg-purple-50 text-purple-800' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
          <p>
            {isAdmin
              ? 'Estás en el panel de administradores. Tienes acceso a la gestión de nodos y sesiones, además de todas las herramientas multimedia.'
              : 'Estás en el panel de usuarios. Disfruta del reproductor, conversión y compartición de archivos.'}
          </p>
          {currentSession && (
            <p className="mt-2 text-xs">
              Última actividad: {new Date(currentSession.lastActivity).toLocaleTimeString()} · Estado: {formatSessionStatus(currentSession.status)}
            </p>
          )}
        </div>
        <Tabs defaultValue="player" className="space-y-6">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-5' : 'grid-cols-3'} lg:w-auto lg:inline-grid`}>
            <TabsTrigger value="player" className="flex items-center gap-2">
              <Music className="w-4 h-4" />
              <span className="hidden sm:inline">Reproductor</span>
            </TabsTrigger>
            <TabsTrigger value="converter" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Conversión</span>
            </TabsTrigger>
            <TabsTrigger value="sharing" className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Compartir</span>
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="nodes" className="flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  <span className="hidden sm:inline">Nodos</span>
                </TabsTrigger>
                <TabsTrigger value="sessions" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Sesiones</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="player">
            <MediaPlayer />
          </TabsContent>

          <TabsContent value="converter">
            <FileConverter />
          </TabsContent>

          <TabsContent value="sharing">
            <FileSharing />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="nodes">
              <NodeMonitor />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="sessions">
              <UserSessions />
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-600">
            <div>
              <h3 className="mb-2">Características</h3>
              <ul className="space-y-1">
                <li>✓ Reproducción local y remota</li>
                <li>✓ Conversión de formatos</li>
                <li>✓ Compartir archivos</li>
                <li>✓ Procesamiento distribuido</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2">Formatos Soportados</h3>
              <ul className="space-y-1">
                <li>Audio: MP3, FLAC, WAV, AAC, OGG</li>
                <li>Video: MP4, AVI, MKV, MOV, WEBM</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2">Sistema Distribuido</h3>
              <ul className="space-y-1">
                <li>Múltiples nodos de procesamiento</li>
                <li>Monitoreo en tiempo real</li>
                <li>Balanceo de carga automático</li>
                <li>Alta disponibilidad</li>
              </ul>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t text-center text-sm text-gray-500">
            <p>MediaStream - Sistema Multimedia Distribuido © 2025</p>
            <p className="mt-1">Proyecto Académico - Sistemas Operativos Distribuidos</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
