import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Upload, Download, Share2, User, Clock, HardDrive } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface SharedFile {
  id: string;
  name: string;
  format: string;
  size: string;
  owner: string;
  sharedWith: string[];
  uploadDate: string;
  downloads: number;
  node: string;
}

const mockSharedFiles: SharedFile[] = [
  {
    id: '1',
    name: 'Proyecto Final.mp4',
    format: 'MP4',
    size: '245 MB',
    owner: 'usuario1',
    sharedWith: ['usuario2', 'usuario3', 'usuario4'],
    uploadDate: '2025-10-15',
    downloads: 12,
    node: 'Node-01',
  },
  {
    id: '2',
    name: 'Presentación.flac',
    format: 'FLAC',
    size: '56 MB',
    owner: 'usuario2',
    sharedWith: ['usuario1', 'usuario5'],
    uploadDate: '2025-10-14',
    downloads: 8,
    node: 'Node-02',
  },
  {
    id: '3',
    name: 'Tutorial React.mp4',
    format: 'MP4',
    size: '180 MB',
    owner: 'usuario3',
    sharedWith: ['usuario1', 'usuario2', 'usuario4', 'usuario6'],
    uploadDate: '2025-10-13',
    downloads: 25,
    node: 'Node-03',
  },
];

const mockMyFiles: SharedFile[] = [
  {
    id: '4',
    name: 'Mi Canción.mp3',
    format: 'MP3',
    size: '4.2 MB',
    owner: 'demo_user',
    sharedWith: ['usuario1', 'usuario2'],
    uploadDate: '2025-10-16',
    downloads: 3,
    node: 'Node-01',
  },
  {
    id: '5',
    name: 'Video Tutorial.mp4',
    format: 'MP4',
    size: '125 MB',
    owner: 'demo_user',
    sharedWith: [],
    uploadDate: '2025-10-15',
    downloads: 0,
    node: 'Node-02',
  },
];

export function FileSharing() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsUploading(false), 500);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  return (
    <Tabs defaultValue="shared" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="shared">Archivos Compartidos</TabsTrigger>
        <TabsTrigger value="myfiles">Mis Archivos</TabsTrigger>
        <TabsTrigger value="upload">Subir Archivo</TabsTrigger>
      </TabsList>

      <TabsContent value="shared" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Archivos Compartidos Conmigo</CardTitle>
            <CardDescription>
              Archivos que otros usuarios han compartido contigo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockSharedFiles.map((file) => (
                <div key={file.id} className="p-4 border rounded-lg hover:border-primary transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="mb-1">{file.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Badge variant="secondary">{file.format}</Badge>
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {file.size}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {file.owner}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline">{file.node}</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {file.uploadDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        {file.downloads} descargas
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3 h-3" />
                        {file.sharedWith.length} usuarios
                      </span>
                    </div>
                    <Button size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Descargar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="myfiles" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Mis Archivos Compartidos</CardTitle>
            <CardDescription>
              Archivos que has subido y compartido con otros usuarios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockMyFiles.map((file) => (
                <div key={file.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="mb-1">{file.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Badge variant="secondary">{file.format}</Badge>
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {file.size}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline">{file.node}</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {file.uploadDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        {file.downloads} descargas
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3 h-3" />
                        {file.sharedWith.length > 0
                          ? `Compartido con ${file.sharedWith.length} usuarios`
                          : 'Privado'}
                      </span>
                    </div>
                    <Button size="sm" variant="outline">
                      <Share2 className="w-4 h-4 mr-2" />
                      Compartir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="upload" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Subir Nuevo Archivo</CardTitle>
            <CardDescription>
              Sube archivos multimedia al sistema distribuido
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="mb-2">Arrastra archivos aquí o haz clic para seleccionar</p>
              <p className="text-sm text-gray-500">
                Soporta MP3, FLAC, WAV, MP4, AVI, MKV (Max 500 MB)
              </p>
              <Button className="mt-4">Seleccionar Archivos</Button>
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Subiendo archivo...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            <div className="space-y-3">
              <label className="text-sm">Compartir con usuarios (opcional)</label>
              <Input placeholder="usuario1, usuario2, usuario3..." />
            </div>

            <div className="space-y-3">
              <label className="text-sm">Nodo de destino</label>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline">Node-01</Button>
                <Button variant="outline">Node-02</Button>
                <Button variant="outline">Node-03</Button>
              </div>
            </div>

            <Button onClick={handleUpload} className="w-full" disabled={isUploading}>
              <Upload className="w-4 h-4 mr-2" />
              Subir Archivo
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
