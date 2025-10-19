import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Users, Activity, Clock, MapPin, LogOut } from 'lucide-react';

interface UserSession {
  id: string;
  username: string;
  status: 'active' | 'idle' | 'offline';
  currentActivity: string;
  location: string;
  loginTime: string;
  duration: string;
  node: string;
}

const mockSessions: UserSession[] = [
  {
    id: '1',
    username: 'usuario1',
    status: 'active',
    currentActivity: 'Reproduciendo: Summer Vibes.mp3',
    location: 'Node-01',
    loginTime: '10:30 AM',
    duration: '2h 15m',
    node: 'Node-01',
  },
  {
    id: '2',
    username: 'usuario2',
    status: 'active',
    currentActivity: 'Convirtiendo: video.avi → MP4',
    location: 'Node-02',
    loginTime: '09:45 AM',
    duration: '3h 00m',
    node: 'Node-02',
  },
  {
    id: '3',
    username: 'usuario3',
    status: 'idle',
    currentActivity: 'En espera',
    location: 'Node-01',
    loginTime: '08:20 AM',
    duration: '4h 25m',
    node: 'Node-01',
  },
  {
    id: '4',
    username: 'usuario4',
    status: 'active',
    currentActivity: 'Subiendo archivo: presentation.flac',
    location: 'Node-03',
    loginTime: '11:15 AM',
    duration: '1h 30m',
    node: 'Node-03',
  },
  {
    id: '5',
    username: 'usuario5',
    status: 'active',
    currentActivity: 'Reproduciendo: Tutorial React.mp4',
    location: 'Node-02',
    loginTime: '10:00 AM',
    duration: '2h 45m',
    node: 'Node-02',
  },
  {
    id: '6',
    username: 'usuario6',
    status: 'idle',
    currentActivity: 'En espera',
    location: 'Node-03',
    loginTime: '07:30 AM',
    duration: '5h 15m',
    node: 'Node-03',
  },
];

export function UserSessions() {
  const getStatusColor = (status: UserSession['status']) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'idle':
        return 'secondary';
      case 'offline':
        return 'outline';
    }
  };

  const activeUsers = mockSessions.filter((s) => s.status === 'active').length;
  const idleUsers = mockSessions.filter((s) => s.status === 'idle').length;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Usuarios Totales</p>
                <p className="text-3xl mt-1">{mockSessions.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Usuarios Activos</p>
                <p className="text-3xl mt-1">{activeUsers}</p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Usuarios Inactivos</p>
                <p className="text-3xl mt-1">{idleUsers}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sesiones Activas</CardTitle>
          <CardDescription>
            Control y monitoreo de usuarios conectados al sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Actividad Actual</TableHead>
                <TableHead>Nodo</TableHead>
                <TableHead>Hora de Inicio</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockSessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {session.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{session.username}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(session.status)}>
                      {session.status === 'active' && <Activity className="w-3 h-3 mr-1" />}
                      {session.status === 'idle' && <Clock className="w-3 h-3 mr-1" />}
                      {session.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {session.currentActivity}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      <MapPin className="w-3 h-3" />
                      {session.node}
                    </Badge>
                  </TableCell>
                  <TableCell>{session.loginTime}</TableCell>
                  <TableCell>{session.duration}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Nodo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {['Node-01', 'Node-02', 'Node-03'].map((node) => {
                const count = mockSessions.filter((s) => s.node === node).length;
                const percentage = (count / mockSessions.length) * 100;
                return (
                  <div key={node} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{node}</span>
                      <span>{count} usuarios</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividades Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Activity className="w-4 h-4 mt-1 text-green-500" />
                <div className="flex-1">
                  <p className="text-sm">usuario1 inició reproducción</p>
                  <p className="text-xs text-gray-500">Hace 5 minutos</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Activity className="w-4 h-4 mt-1 text-blue-500" />
                <div className="flex-1">
                  <p className="text-sm">usuario2 inició conversión</p>
                  <p className="text-xs text-gray-500">Hace 12 minutos</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Activity className="w-4 h-4 mt-1 text-purple-500" />
                <div className="flex-1">
                  <p className="text-sm">usuario4 subió un archivo</p>
                  <p className="text-xs text-gray-500">Hace 18 minutos</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Activity className="w-4 h-4 mt-1 text-green-500" />
                <div className="flex-1">
                  <p className="text-sm">usuario5 descargó un archivo</p>
                  <p className="text-xs text-gray-500">Hace 25 minutos</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estadísticas de Sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Duración promedio</p>
                <p className="text-2xl mt-1">3h 12m</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Sesiones hoy</p>
                <p className="text-2xl mt-1">18</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Pico de usuarios</p>
                <p className="text-2xl mt-1">12 usuarios</p>
                <p className="text-xs text-gray-500">A las 11:30 AM</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
