import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Server, Cpu, HardDrive, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface NodeStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning';
  cpu: number;
  ram: number;
  storage: number;
  network: number;
  tasks: number;
  location: string;
  uptime: string;
}

const initialNodes: NodeStatus[] = [
  {
    id: '1',
    name: 'Node-01',
    status: 'online',
    cpu: 45,
    ram: 62,
    storage: 78,
    network: 23,
    tasks: 3,
    location: 'US-East',
    uptime: '15d 8h',
  },
  {
    id: '2',
    name: 'Node-02',
    status: 'online',
    cpu: 78,
    ram: 85,
    storage: 45,
    network: 67,
    tasks: 7,
    location: 'EU-West',
    uptime: '8d 12h',
  },
  {
    id: '3',
    name: 'Node-03',
    status: 'warning',
    cpu: 92,
    ram: 95,
    storage: 88,
    network: 89,
    tasks: 12,
    location: 'Asia-East',
    uptime: '22d 4h',
  },
  {
    id: '4',
    name: 'Node-04',
    status: 'online',
    cpu: 34,
    ram: 48,
    storage: 56,
    network: 12,
    tasks: 2,
    location: 'US-West',
    uptime: '5d 16h',
  },
];

export function NodeMonitor() {
  const [nodes, setNodes] = useState<NodeStatus[]>(initialNodes);

  useEffect(() => {
    const interval = setInterval(() => {
      setNodes((prevNodes) =>
        prevNodes.map((node) => ({
          ...node,
          cpu: Math.min(100, Math.max(0, node.cpu + (Math.random() - 0.5) * 10)),
          ram: Math.min(100, Math.max(0, node.ram + (Math.random() - 0.5) * 8)),
          network: Math.min(100, Math.max(0, node.network + (Math.random() - 0.5) * 15)),
          status:
            node.cpu > 90 || node.ram > 90 ? 'warning' : 'online',
        }))
      );
    }, 2000);

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

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Nodos Activos</p>
                <p className="text-3xl mt-1">{nodes.filter((n) => n.status === 'online').length}</p>
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
                <p className="text-3xl mt-1">{nodes.reduce((acc, n) => acc + n.tasks, 0)}</p>
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
                  {Math.round(nodes.reduce((acc, n) => acc + n.cpu, 0) / nodes.length)}%
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
                <p className="text-3xl mt-1">{nodes.filter((n) => n.status === 'warning').length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {nodes.map((node) => (
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
                {node.location} • Uptime: {node.uptime} • {node.tasks} tareas activas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    CPU
                  </span>
                  <span>{Math.round(node.cpu)}%</span>
                </div>
                <Progress value={node.cpu} className={getProgressColor(node.cpu)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4" />
                    RAM
                  </span>
                  <span>{Math.round(node.ram)}%</span>
                </div>
                <Progress value={node.ram} className={getProgressColor(node.ram)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4" />
                    Storage
                  </span>
                  <span>{Math.round(node.storage)}%</span>
                </div>
                <Progress value={node.storage} className={getProgressColor(node.storage)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Network
                  </span>
                  <span>{Math.round(node.network)}%</span>
                </div>
                <Progress value={node.network} className={getProgressColor(node.network)} />
              </div>

              {node.status === 'warning' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Recursos cercanos al límite. Considerar redistribución de tareas.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
