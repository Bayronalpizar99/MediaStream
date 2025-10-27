import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Users, Activity, Clock, MapPin, LogOut, AlertCircle, Loader2 } from 'lucide-react';
import { sessionService } from '../services/sessionService';
import { AuthSession, SessionStatus } from '../models';
import { ERROR_MESSAGES } from '../constants';

const STATUS_LABELS: Record<SessionStatus, string> = {
  active: 'Activa',
  idle: 'En reposo',
  expired: 'Expirada',
  terminated: 'Terminada',
};

const STATUS_VARIANTS: Record<SessionStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  idle: 'secondary',
  expired: 'outline',
  terminated: 'destructive',
};

const STATUS_ICON_CLASSES: Record<SessionStatus, string> = {
  active: 'text-green-500',
  idle: 'text-yellow-500',
  expired: 'text-gray-400',
  terminated: 'text-red-500',
};

const formatDateTime = (iso: string) => new Date(iso).toLocaleString();

const formatRelativeTime = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) {
    return 'Sin datos';
  }

  if (diffMs < 30_000) {
    return 'Hace unos segundos';
  }
  if (diffMs < 60_000) {
    return 'Hace menos de un minuto';
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `Hace ${diffMinutes} minuto${diffMinutes === 1 ? '' : 's'}`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Hace ${diffHours} hora${diffHours === 1 ? '' : 's'}`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} día${diffDays === 1 ? '' : 's'}`;
};

const formatDurationFromMs = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

const getInitials = (value?: string | null) =>
  value && value.length > 0 ? value.substring(0, 2).toUpperCase() : 'NA';

const renderStatusIcon = (status: SessionStatus) => {
  const iconClass = STATUS_ICON_CLASSES[status];
  switch (status) {
    case 'active':
      return <Activity className={`w-3 h-3 ${iconClass}`} />;
    case 'idle':
      return <Clock className={`w-3 h-3 ${iconClass}`} />;
    case 'terminated':
      return <LogOut className={`w-3 h-3 ${iconClass}`} />;
    case 'expired':
    default:
      return <Clock className={`w-3 h-3 ${iconClass}`} />;
  }
};

export function UserSessions() {
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);

  const fetchSessions = async (showLoader = false) => {
    try {
      if (showLoader) {
        setIsLoading(true);
      }
      const data = await sessionService.getSessions();
      setSessions(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || ERROR_MESSAGES.GENERIC_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchSessions(true);
  }, []);

  const handleTerminate = async (sessionId: string) => {
    try {
      setTerminatingId(sessionId);
      await sessionService.terminateSession(sessionId);
      await fetchSessions(false);
    } catch (err: any) {
      setError(err?.message || ERROR_MESSAGES.GENERIC_ERROR);
    } finally {
      setTerminatingId(null);
    }
  };

  const totalSessions = sessions.length;
  const activeCount = useMemo(() => sessions.filter((s) => s.status === 'active').length, [sessions]);
  const idleCount = useMemo(() => sessions.filter((s) => s.status === 'idle').length, [sessions]);
  const expiredCount = useMemo(() => sessions.filter((s) => s.status === 'expired').length, [sessions]);
  const terminatedCount = useMemo(() => sessions.filter((s) => s.status === 'terminated').length, [sessions]);
  const inactiveCount = idleCount + expiredCount + terminatedCount;

  const roleDistribution = useMemo(() => {
    return sessions.reduce<Record<string, number>>((acc, session) => {
      const role = session.role ?? 'user';
      acc[role] = (acc[role] ?? 0) + 1;
      return acc;
    }, {});
  }, [sessions]);

  const recentSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
      .slice(0, 4);
  }, [sessions]);

  const averageDuration = useMemo(() => {
    if (!sessions.length) {
      return '0s';
    }

    const totalMs = sessions.reduce((acc, session) => {
      const endIso = session.terminatedAt ?? session.lastActivity ?? new Date().toISOString();
      return acc + (new Date(endIso).getTime() - new Date(session.createdAt).getTime());
    }, 0);

    return formatDurationFromMs(totalMs / sessions.length);
  }, [sessions]);

  const sessionsToday = useMemo(() => {
    const today = new Date().toDateString();
    return sessions.filter((session) => new Date(session.createdAt).toDateString() === today).length;
  }, [sessions]);

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Usuarios conectados</p>
                <p className="text-3xl mt-1">{totalSessions}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Sesiones activas</p>
                <p className="text-3xl mt-1">{activeCount}</p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Sesiones inactivas</p>
                <p className="text-3xl mt-1">{inactiveCount}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sesiones Activas</CardTitle>
          <CardDescription>Control y monitoreo de usuarios conectados al sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Última actividad</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Cargando sesiones activas...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : totalSessions === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500">
                    No hay sesiones activas en este momento.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => {
                  const canTerminate = session.status === 'active' || session.status === 'idle';
                  const isTerminating = terminatingId === session.id;

                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{getInitials(session.username ?? session.email)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span>{session.username ?? 'Sin nombre'}</span>
                            <span className="text-xs text-gray-500">{session.email ?? session.userId}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase tracking-wide text-xs">
                          {session.role ?? 'user'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[session.status]}>
                          {renderStatusIcon(session.status)}
                          {STATUS_LABELS[session.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(session.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{formatDateTime(session.lastActivity)}</span>
                          <span className="text-xs text-gray-500">{formatRelativeTime(session.lastActivity)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-gray-500" />
                          <span className="text-sm text-gray-600">{session.ipAddress ?? 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-gray-600">
                        {session.userAgent ?? 'Sin información'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canTerminate || isTerminating}
                          onClick={() => handleTerminate(session.id)}
                        >
                          {isTerminating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <LogOut className="w-4 h-4 mr-1" />
                              Forzar cierre
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribución por rol</CardTitle>
            <CardDescription>Usuarios conectados según rol asignado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.keys(roleDistribution).length === 0 && (
                <p className="text-sm text-gray-500">No hay sesiones registradas.</p>
              )}
              {Object.entries(roleDistribution).map(([role, count]) => {
                const percentage = totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0;
                return (
                  <div key={role} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="uppercase tracking-wide text-gray-600">{role}</span>
                      <span>{count} usuario{count === 1 ? '' : 's'}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>Últimos movimientos dentro de la plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSessions.length === 0 && (
                <p className="text-sm text-gray-500">Aún no hay actividad registrada.</p>
              )}
              {recentSessions.map((session) => (
                <div key={session.id} className="flex items-start gap-3">
                  {renderStatusIcon(session.status)}
                  <div className="flex-1">
                    <p className="text-sm">
                      {session.username ?? session.email ?? session.userId} · {STATUS_LABELS[session.status]}
                    </p>
                    <p className="text-xs text-gray-500">{formatRelativeTime(session.lastActivity)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estadísticas de sesión</CardTitle>
            <CardDescription>Resumen general del uso actual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Duración promedio</p>
                <p className="text-2xl mt-1">{averageDuration}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Sesiones iniciadas hoy</p>
                <p className="text-2xl mt-1">{sessionsToday}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Sesiones finalizadas</p>
                <p className="text-2xl mt-1">{terminatedCount + expiredCount}</p>
                <p className="text-xs text-gray-500">Incluye sesiones expiradas y cerradas manualmente</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
