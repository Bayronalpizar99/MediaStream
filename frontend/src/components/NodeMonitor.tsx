import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Server, Cpu, HardDrive, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { nodeService, type NodeStatus as ApiNodeStatus } from '../services/nodeService';
import { Button } from './ui/button';

type NodeStatus = ApiNodeStatus & {
  metrics: NonNullable<ApiNodeStatus['metrics']>;
};

const normalizeMetrics = (node: ApiNodeStatus): NodeStatus => ({
  ...node,
  metrics: {
    cpu: node.metrics?.cpu ?? 0,
    ram: node.metrics?.ram ?? 0,
    tasks: node.metrics?.tasks ?? 0,
    uptimeSeconds: node.metrics?.uptimeSeconds ?? 0,
  },
});

export function NodeMonitor() {
  const [nodes, setNodes] = useState<NodeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNodes = async () => {
    try {
      setError(null);
      const data = await nodeService.getNodes();
      setNodes(data.map(normalizeMetrics));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el estado de los nodos';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNodes();
    const interval = setInterval(() => {
      void loadNodes();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: NodeStatus['status']) => {
    switch (status) {
      case 'online':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'offline':
        return 'destructive';
    }
  };

  const getStatusIcon = (status: NodeStatus['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      case 'offline':
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getProgressColor = (value: number) => {
    if (value > 90) return 'bg-red-500';
    if (value > 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const totalActive = nodes.filter((n) => n.status === 'online').length;
  const totalTasks = nodes.reduce((acc, n) => acc + (n.metrics.tasks ?? 0), 0);
  const avgCpu = nodes.length
    ? Math.round(nodes.reduce((acc, n) => acc + (n.metrics.cpu ?? 0), 0) / nodes.length)
    : 0;
  const totalAlerts = nodes.filter((n) => n.status !== 'online').length;

  const formatUptime = (seconds: number) => {
    if (!seconds) return 'N/D';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div className="relative h-48 rounded-lg overflow-hidden">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1698668975271-2ba9a323be6b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzZXJ2ZXIlMjBuZXR3b3JrJTIwY2xvdWR8ZW58MXx8fHwxNzYwNTc1OTIyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Server network"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center">
          <div className="p-6 text-white">
            <h2 className="text-3xl mb-2">Monitoreo de Nodos Distribuidos</h2>
            <p className="text-gray-200">
              Sistema de monitoreo en tiempo real de recursos y tareas
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Estado global</h3>
          <p className="text-sm text-muted-foreground">
            Monitoreo del coordinador y microservicios dedicados
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadNodes()} disabled={loading}>
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Nodos Activos</p>
                <p className="text-3xl mt-1">{totalActive}</p>
              </div>
              <Server className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tareas Totales</p>
                <p className="text-3xl mt-1">{totalTasks}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">CPU Promedio</p>
                <p className="text-3xl mt-1">
                  {nodes.length ? `${avgCpu}%` : 'N/D'}
                </p>
              </div>
              <Cpu className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Alertas</p>
                <p className="text-3xl mt-1">{totalAlerts}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {nodes.map((node) => {
          const cpuValue = Math.min(100, Math.round(node.metrics.cpu ?? 0));
          const ramValue = Math.min(100, Math.round(node.metrics.ram ?? node.metrics.cpu ?? 0));
          const taskLoad = Math.min(100, (node.metrics.tasks ?? 0) * 10);
          const uptime = formatUptime(node.metrics.uptimeSeconds ?? 0);

          return (
          <Card key={node.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5" />
                  <CardTitle>{node.name}</CardTitle>
                </div>
                <Badge variant={getStatusColor(node.status)} className="flex items-center gap-1">
                  {getStatusIcon(node.status)}
                  {node.status}
                </Badge>
              </div>
              <CardDescription>
                Rol: {node.role} • {node.location ?? 'local'} • Uptime: {uptime}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    CPU actual
                  </span>
                  <span>{cpuValue}%</span>
                </div>
                <Progress value={cpuValue} className={getProgressColor(cpuValue)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4" />
                    Uso de memoria
                  </span>
                  <span>{ramValue}%</span>
                </div>
                <Progress value={ramValue} className={getProgressColor(ramValue)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Carga de tareas
                  </span>
                  <span>{Math.round(taskLoad)}%</span>
                </div>
                <Progress value={taskLoad} className={getProgressColor(taskLoad)} />
              </div>

              {node.status !== 'online' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Recursos fuera de umbral. Verifica la asignación de tareas en este nodo.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
        {nodes.length === 0 && !loading && (
          <div className="md:col-span-2 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No hay nodos registrados aún. Verifica que los microservicios se hayan levantado y registrado con el coordinador.
          </div>
        )}
      </div>
    </div>
  );
}
