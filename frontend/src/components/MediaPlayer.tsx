import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Music,
  RefreshCw,
  UploadCloud,
  Loader2,
} from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { AudioFile } from '../models';
import { mediaService } from '../services/mediaService';

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
};

export function MediaPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);

  const currentFile = useMemo(
    () => (selectedIndex !== null ? audioFiles[selectedIndex] ?? null : null),
    [audioFiles, selectedIndex]
  );

  const loadAudioLibrary = useCallback(async (options?: { selectUrl?: string }) => {
    setError(null);
    setIsRefreshing(true);
    try {
      const files = await mediaService.listAudio();
      setAudioFiles(files);
      setSelectedIndex((prev) => {
        if (files.length === 0) {
          return null;
        }
        if (options?.selectUrl) {
          const targetIndex = files.findIndex((file) => file.url === options.selectUrl);
          if (targetIndex >= 0) {
            return targetIndex;
          }
        }
        if (prev === null) {
          return 0;
        }
        return Math.min(prev, files.length - 1);
      });
    } catch (err) {
      console.error('Error loading audio files:', err);
      setError('No se pudieron cargar los archivos de audio. Intenta nuevamente.');
      setAudioFiles([]);
      setSelectedIndex(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        await loadAudioLibrary();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    void init();

    return () => {
      isMounted = false;
    };
  }, [loadAudioLibrary]);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) {
      return;
    }

    const handleLoadedMetadata = () => {
      const audioDuration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
      setDuration(audioDuration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audioElement.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleError = () => {
      setError('Ocurrió un problema al reproducir el archivo de audio.');
      setIsPlaying(false);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('ended', handleEnded);
    audioElement.addEventListener('error', handleError);
    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);

    return () => {
      audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('error', handleError);
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
    };
  }, []);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) {
      return;
    }

    if (!currentFile) {
      audioElement.pause();
      audioElement.removeAttribute('src');
      audioElement.load();
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    setError(null);
    const source = mediaService.resolveStreamUrl(currentFile);
    audioElement.src = source;
    audioElement.load();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [currentFile]);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) {
      return;
    }

    const volumeValue = isMuted ? 0 : volume / 100;
    audioElement.volume = volumeValue;
  }, [volume, isMuted]);

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null);
      setIsUploading(true);
      try {
        const uploaded = await mediaService.uploadAudio(file);
        await loadAudioLibrary({ selectUrl: uploaded.url });
      } catch (err) {
        console.error('Upload error:', err);
        const message =
          err instanceof Error ? err.message : 'No se pudo subir el archivo de audio.';
        setError(message);
      } finally {
        setIsUploading(false);
      }
    },
    [loadAudioLibrary]
  );

  const handleFileSelection = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { files } = event.target;
      if (!files || files.length === 0) {
        return;
      }
      const file = files[0];
      event.target.value = '';
      void handleUpload(file);
    },
    [handleUpload]
  );

  const handleTogglePlay = async () => {
    const audioElement = audioRef.current;
    if (!audioElement || !currentFile) {
      return;
    }

    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audioElement.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('Playback error:', err);
      setError('No se pudo iniciar la reproducción. Verifica tu sesión o el archivo.');
    }
  };

  const handleStop = () => {
    const audioElement = audioRef.current;
    if (!audioElement) {
      return;
    }

    audioElement.pause();
    audioElement.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (value: number[]) => {
    const [percent] = value;
    const audioElement = audioRef.current;
    if (!audioElement || !duration) {
      return;
    }

    const nextTime = (percent / 100) * duration;
    audioElement.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolumeChange = (value: number[]) => {
    const [nextVolume] = value;
    setVolume(nextVolume ?? 0);
    setIsMuted((nextVolume ?? 0) === 0);
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const selectFile = (index: number) => {
    if (index === selectedIndex) {
      return;
    }
    setSelectedIndex(index);
    setError(null);
  };

  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <audio ref={audioRef} className="hidden" preload="metadata" />
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Reproductor de Audio</CardTitle>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.flac,.wav,audio/mpeg,audio/flac,audio/wav"
                  onChange={handleFileSelection}
                  className="hidden"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">Subir audio</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadAudioLibrary()}
                  disabled={isRefreshing || isUploading}
                >
                  {isRefreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">Actualizar</span>
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Formatos soportados: MP3, FLAC y WAV · Tamaño máximo 100&nbsp;MB por archivo.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="aspect-video bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center relative overflow-hidden">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1661922028028-e3c340d459d4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhdWRpbyUyMHdhdmVmb3JtJTIwbXVzaWN8ZW58MXx8fHwxNzYwNTc1OTIyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Audio waveform"
                className="absolute inset-0 w-full h-full object-cover opacity-30"
              />
              <div className="relative z-10">
                <Music className="w-24 h-24 text-white" />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold">
                    {currentFile ? currentFile.name : 'Selecciona un archivo para reproducir'}
                  </h3>
                  {currentFile && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                      <Badge variant="secondary" className="uppercase">
                        {currentFile.format}
                      </Badge>
                      <span>•</span>
                      <span>{formatBytes(currentFile.size)}</span>
                      {currentFile.mimeType && (
                        <>
                          <span>•</span>
                          <span>{currentFile.mimeType}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>
                        {duration > 0 ? `Duración: ${formatTime(duration)}` : 'Duración: --:--'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Slider
                  value={[progress]}
                  disabled={!currentFile || duration === 0}
                  onValueChange={handleSeek}
                  max={100}
                  step={1}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Button type="button" size="icon" onClick={handleTogglePlay} disabled={!currentFile}>
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleStop}
                  disabled={!currentFile}
                >
                  <Square className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="icon" onClick={toggleMute} disabled={!currentFile}>
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Slider
                  value={isMuted ? [0] : [volume]}
                  disabled={!currentFile}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                  className="w-32"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>Biblioteca Local</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando archivos de audio...
              </div>
            ) : audioFiles.length === 0 ? (
              <p className="text-sm text-gray-500">
                No hay archivos en la biblioteca local. Copia archivos MP3, FLAC o WAV a la ruta
                configurada en el servidor y presiona &quot;Actualizar&quot;.
              </p>
            ) : (
              audioFiles.map((file, index) => (
                <button
                  key={`${file.name}-${file.url}`}
                  type="button"
                  onClick={() => selectFile(index)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedIndex === index
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{file.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs opacity-80">
                        <Badge
                          variant={selectedIndex === index ? 'outline' : 'secondary'}
                          className="text-[10px] uppercase"
                        >
                          {file.format}
                        </Badge>
                        <span>{formatBytes(file.size)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
