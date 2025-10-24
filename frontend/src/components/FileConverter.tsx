import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { RefreshCw, CheckCircle, FileAudio, FileVideo, ArrowRight } from 'lucide-react';

interface ConversionTask {
  id: string;
  fileName: string;
  fromFormat: string;
  toFormat: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  originalSize: string;
  convertedSize: string;
  node: string;
}

const audioFormats = ['MP3', 'FLAC', 'WAV', 'AAC', 'OGG'];
const videoFormats = ['MP4', 'AVI', 'MKV', 'MOV', 'WEBM'];

const mockTasks: ConversionTask[] = [
  {
    id: '1',
    fileName: 'song.flac',
    fromFormat: 'FLAC',
    toFormat: 'MP3',
    status: 'completed',
    progress: 100,
    originalSize: '48 MB',
    convertedSize: '4.2 MB',
    node: 'Node-02',
  },
  {
    id: '2',
    fileName: 'video.avi',
    fromFormat: 'AVI',
    toFormat: 'MP4',
    status: 'processing',
    progress: 65,
    originalSize: '850 MB',
    convertedSize: '--',
    node: 'Node-01',
  },
  {
    id: '3',
    fileName: 'recording.wav',
    fromFormat: 'WAV',
    toFormat: 'MP3',
    status: 'completed',
    progress: 100,
    originalSize: '92 MB',
    convertedSize: '8.5 MB',
    node: 'Node-03',
  },
];

export function FileConverter() {
  const [selectedFile, setSelectedFile] = useState('Summer Vibes.flac');
  const [fromFormat, setFromFormat] = useState('FLAC');
  const [toFormat, setToFormat] = useState('MP3');
  const [mediaType, setMediaType] = useState<'audio' | 'video'>('audio');
  const [tasks, setTasks] = useState<ConversionTask[]>(mockTasks);

  const handleConvert = () => {
    const newTask: ConversionTask = {
      id: Date.now().toString(),
      fileName: selectedFile,
      fromFormat,
      toFormat,
      status: 'pending',
      progress: 0,
      originalSize: '45 MB',
      convertedSize: '--',
      node: `Node-0${Math.floor(Math.random() * 3) + 1}`,
    };
    setTasks([newTask, ...tasks]);

    // Simulate conversion progress
    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) => (t.id === newTask.id ? { ...t, status: 'processing', progress: 30 } : t))
      );
    }, 1000);

    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) => (t.id === newTask.id ? { ...t, progress: 60 } : t))
      );
    }, 2000);

    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === newTask.id
            ? { ...t, status: 'completed', progress: 100, convertedSize: '4.1 MB' }
            : t
        )
      );
    }, 3000);
  };

  const getStatusColor = (status: ConversionTask['status']) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formats = mediaType === 'audio' ? audioFormats : videoFormats;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Convertir Archivos</CardTitle>
          <CardDescription>
            Convierte archivos multimedia entre diferentes formatos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm">Tipo de medio</label>
            <div className="flex gap-2">
              <Button
                variant={mediaType === 'audio' ? 'default' : 'outline'}
                onClick={() => setMediaType('audio')}
                className="flex-1"
              >
                <FileAudio className="w-4 h-4 mr-2" />
                Audio
              </Button>
              <Button
                variant={mediaType === 'video' ? 'default' : 'outline'}
                onClick={() => setMediaType('video')}
                className="flex-1"
              >
                <FileVideo className="w-4 h-4 mr-2" />
                Video
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm">Archivo</label>
            <Select value={selectedFile} onValueChange={setSelectedFile}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Summer Vibes.flac">Summer Vibes.flac</SelectItem>
                <SelectItem value="Jazz Night.wav">Jazz Night.wav</SelectItem>
                <SelectItem value="Tutorial.mp4">Tutorial.mp4</SelectItem>
                <SelectItem value="Conference.avi">Conference.avi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm">Formato origen</label>
              <Select value={fromFormat} onValueChange={setFromFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formats.map((format) => (
                    <SelectItem key={format} value={format}>
                      {format}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ArrowRight className="w-5 h-5 text-gray-400 mb-3" />

            <div className="space-y-2">
              <label className="text-sm">Formato destino</label>
              <Select value={toFormat} onValueChange={setToFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formats.map((format) => (
                    <SelectItem key={format} value={format}>
                      {format}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleConvert} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Iniciar Conversión
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tareas de Conversión</CardTitle>
          <CardDescription>Estado de las conversiones en proceso</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p>{task.fileName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-500">
                        {task.fromFormat} → {task.toFormat}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {task.node}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant={getStatusColor(task.status)}>
                    {task.status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {task.status === 'processing' && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                    {task.status}
                  </Badge>
                </div>

                {task.status !== 'completed' && (
                  <div className="space-y-1">
                    <Progress value={task.progress} />
                    <p className="text-xs text-gray-500">{task.progress}% completado</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Tamaño original: {task.originalSize}</span>
                  {task.convertedSize !== '--' && (
                    <span className="text-green-600">Convertido: {task.convertedSize}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
