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

interface User {
  email: string;
  username: string;
  id: string;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const session = authService.getSession();
    if (session?.user) {
      setCurrentUser(session.user);
      setIsLoggedIn(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    authService.clearSession();
    setIsLoggedIn(false);
    setCurrentUser(null);
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
              </div>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="player" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
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
            <TabsTrigger value="nodes" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              <span className="hidden sm:inline">Nodos</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Sesiones</span>
            </TabsTrigger>
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

          <TabsContent value="nodes">
            <NodeMonitor />
          </TabsContent>

          <TabsContent value="sessions">
            <UserSessions />
          </TabsContent>
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
