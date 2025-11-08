import { useState, useEffect } from 'react'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Upload, Download, Share2, User, Clock, HardDrive, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { mediaService } from '../services/mediaService'; 
import { toast } from 'sonner'; // Para notificaciones
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Label } from './ui/label';

interface MediaFile {
  id: string;
  filename: string;
  contentType: string;
  size: number; 
  ownerId: string;
  ownerUsername: string;
  createdAt: string; 
  sharedWith: string[];
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function FileSharing() {
  const [myFiles, setMyFiles] = useState<MediaFile[]>([]);
  const [sharedFiles, setSharedFiles] = useState<MediaFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [fileToShare, setFileToShare] = useState<MediaFile | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const loadFiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [myFilesData, sharedFilesData] = await Promise.all([
        mediaService.getMyFiles(),
        mediaService.getSharedWithMe(),
      ]);
      setMyFiles(myFilesData);
      setSharedFiles(sharedFilesData);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load files';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.warning('Por favor, selecciona un archivo primero.');
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const response = await mediaService.uploadFile(selectedFile);
      toast.success(`Archivo "${response.file.filename}" subido con éxito.`);
      setSelectedFile(null); 
      loadFiles();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to upload file';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  // 7. Manejador para eliminar un archivo
  const handleDelete = async (file: MediaFile) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar "${file.filename}"?`)) {
      return;
    }
    try {
      await mediaService.deleteFile(file.id);
      toast.success(`Archivo "${file.filename}" eliminado.`);
      loadFiles(); 
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  const handleShare = async () => {
    if (!fileToShare) {
      toast.error('No se ha seleccionado ningún archivo para compartir.');
      return;
    }
    
    const email = shareEmail; 
    if (!email) {
      toast.warning('Por favor, introduce un email.');
      return;
    }
    try {
      await mediaService.shareFile(fileToShare.id, email); 
      toast.success(`Archivo compartido con ${email}.`);
      loadFiles(); 
      setFileToShare(null); 
      setShareEmail(''); 
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to share file');
    }
  };

  return (
    <>
      <Tabs defaultValue="shared" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="shared">Archivos Compartidos</TabsTrigger>
          <TabsTrigger value="myfiles">Mis Archivos</TabsTrigger>
          <TabsTrigger value="upload">Subir Archivo</TabsTrigger>
        </TabsList>

        {}
        {isLoading && <p>Cargando archivos...</p>}
        {error && <p className="text-red-500">{error}</p>}

        <TabsContent value="shared" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Archivos Compartidos Conmigo</CardTitle>
              <CardDescription>Archivos que otros usuarios han compartido contigo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {}
                {sharedFiles.length > 0 ? (
                  sharedFiles.map((file) => (
                    <div key={file.id} className="p-4 border rounded-lg hover:border-primary transition-colors">
                      <div className="flex-1 mb-3">
                        <h3 className="mb-1">{file.filename}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Badge variant="secondary">{file.contentType}</Badge>
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            {formatBytes(file.size)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {file.ownerUsername}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(file.createdAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Share2 className="w-3 h-3" />
                            {file.sharedWith.length} usuarios
                          </span>
                        </div>
                        {}
                        <Button
                          className="h-9 px-3"
                          onClick={async () => {
                            setDownloadingId(file.id);
                            try {
                              await mediaService.downloadFile(file.id, file.filename);
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Failed to download file');
                            } finally {
                              setDownloadingId(null);
                            }
                          }}
                          disabled={downloadingId === file.id}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          {downloadingId === file.id ? 'Descargando...' : 'Descargar'}
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>Nadie ha compartido archivos contigo todavía.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="myfiles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mis Archivos Compartidos</CardTitle>
              <CardDescription>Archivos que has subido y compartido con otros usuarios</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {}
                {myFiles.length > 0 ? (
                  myFiles.map((file) => (
                    <div key={file.id} className="p-4 border rounded-lg">
                      <div className="flex-1 mb-3">
                        <h3 className="mb-1">{file.filename}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Badge variant="secondary">{file.contentType}</Badge>
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            {formatBytes(file.size)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(file.createdAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Share2 className="w-3 h-3" />
                            {file.sharedWith.length > 0
                              ? `Compartido con ${file.sharedWith.length} usuarios`
                              : 'Privado'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          
                          {}
                          <Button
                            className="h-9 px-3"
                            variant="outline"
                            onClick={() => {
                              console.log('Botón de compartir presionado');
                              console.log('Archivo a compartir:', file);
                              setFileToShare(file);
                            }}
                          >
                            <Share2 className="w-4 h-4 mr-2" />
                            Compartir
                          </Button>
                          
                          {}

                          {}
                          <Button className="h-9 px-3" variant="destructive" onClick={() => handleDelete(file)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No has subido ningún archivo todavía.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subir Nuevo Archivo</CardTitle>
              <CardDescription>Sube archivos multimedia al sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {}
              <div className="space-y-2">
                <Label htmlFor="file-upload">Seleccionar archivo</Label>
                <Input
                  id="file-upload"
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                />
                {selectedFile && <p className="text-sm text-muted-foreground">Archivo seleccionado: {selectedFile.name}</p>}
              </div>

              {}
              <Button onClick={handleUpload} className="w-full" disabled={isUploading || !selectedFile}>
                {isUploading ? (
                  'Subiendo...'
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Subir Archivo
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {}
      <Dialog 
        open={!!fileToShare} 
        onOpenChange={(isOpen: boolean) => {
          if (!isOpen) {
            setFileToShare(null); 
            setShareEmail('');
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Compartir {fileToShare?.filename}</DialogTitle>
            <DialogDescription>
              Introduce el email del usuario con quien quieres compartir este archivo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input 
                id="email" 
                placeholder="usuario@ejemplo.com" 
                className="col-span-3"
                value={shareEmail} 
                onChange={(e) => setShareEmail(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleShare}>Compartir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}