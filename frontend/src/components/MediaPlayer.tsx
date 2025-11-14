import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Monitor,
  Music,
  HardDrive,
  Trash2,
} from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { mediaService, type LocalMediaResponse } from "../services/mediaService";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../lib/firebaseClient";

type MediaSource = "cloud" | "local";

interface PlayerMediaFile {
  id: string;
  filename: string;
  storagePath?: string;
  contentType: string;
  size: number;
  source: MediaSource;
  relativePath?: string;
  available?: boolean;
  mediaType?: LocalMediaResponse["mediaType"];
}

type RemoteMediaApiResponse = {
  id: string;
  filename: string;
  storagePath: string;
  contentType?: string;
  size?: number;
};

export function MediaPlayer() {
  const [files, setFiles] = useState<PlayerMediaFile[]>([]);
  const [currentFile, setCurrentFile] = useState<PlayerMediaFile | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [deletingLocalId, setDeletingLocalId] = useState<string | null>(null);
  const [isRegisteringLocal, setIsRegisteringLocal] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const isVideo = currentFile?.contentType.includes("video");

  const refreshLibrary = useCallback(async () => {
    setIsLibraryLoading(true);
    try {
      const [myFiles, sharedFiles, localFiles] = await Promise.all([
        mediaService.getMyFiles(),
        mediaService.getSharedWithMe(),
        mediaService.getLocalFiles(),
      ]);

      const remoteMapped: PlayerMediaFile[] = [...myFiles, ...sharedFiles].map(
        (file: RemoteMediaApiResponse) => ({
          id: file.id,
          filename: file.filename,
          storagePath: file.storagePath,
          contentType: file.contentType ?? "application/octet-stream",
          size: file.size ?? 0,
          source: "cloud",
          available: true,
        }),
      );

      const localMapped: PlayerMediaFile[] = (localFiles ?? []).map(
        (local: LocalMediaResponse) => ({
          id: local.id,
          filename: local.filename,
          contentType: local.contentType,
          size: local.size,
          source: "local",
          relativePath: local.relativePath,
          available: local.available,
          mediaType: local.mediaType,
        }),
      );

      const combined = [...localMapped, ...remoteMapped];
      setFiles(combined);
      setCurrentFile((prev) => {
        if (!combined.length) {
          setCurrentUrl(null);
          setIsPlaying(false);
          return null;
        }
        if (!prev) {
          return combined[0];
        }
        const next = combined.find(
          (file) => file.id === prev.id && file.source === prev.source,
        );
        return next ?? combined[0];
      });
    } catch (error) {
      console.error("Error fetching media files:", error);
    } finally {
      setIsLibraryLoading(false);
    }
  }, []);

  // ✅ Load files when component mounts
  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  // ✅ When file changes, get stream URL
  useEffect(() => {
    let cancelled = false;

    const fetchUrl = async () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      if (!currentFile) {
        setCurrentUrl(null);
        setPlayerError(null);
        setIsPlaying(false);
        return;
      }

      setPlayerError(null);
      setIsPlaying(false);
      setProgress(0);

      if (currentFile.source === "local") {
        if (!currentFile.available) {
          setPlayerError("El archivo local ya no está disponible.");
          setCurrentUrl(null);
          return;
        }
        try {
          const blob = await mediaService.getLocalStream(currentFile.id);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          setCurrentUrl(url);
        } catch (err) {
          console.error("Error fetching local media:", err);
          if (!cancelled) {
            setPlayerError("No se pudo abrir el archivo local.");
            setCurrentUrl(null);
          }
        }
        return;
      }

      if (!currentFile.storagePath) {
        setPlayerError("El archivo seleccionado no tiene una ruta válida.");
        setCurrentUrl(null);
        return;
      }

      try {
        const fileRef = ref(storage, currentFile.storagePath);
        const url = await getDownloadURL(fileRef);
        if (!cancelled) {
          setCurrentUrl(url);
        }
      } catch (err) {
        console.error("Error fetching file URL:", err);
        if (!cancelled) {
          setPlayerError("No se pudo generar la URL de reproducción.");
          setCurrentUrl(null);
        }
      }
    };

    void fetchUrl();

    return () => {
      cancelled = true;
    };
  }, [currentFile]);

  // ✅ Handle play/pause logic
  useEffect(() => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (!media || !currentUrl) {
      return;
    }
    if (isPlaying) media.play();
    else media.pause();
  }, [isPlaying, isVideo, currentUrl]);

  // ✅ Handle volume and mute
  useEffect(() => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (!media) return;
    media.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted, isVideo]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const togglePlay = () => setIsPlaying((p) => !p);
  const toggleMute = () => setIsMuted((m) => !m);

  const handleTimeUpdate = () => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (!media) return;
    const current = media.currentTime;
    const total = media.duration || 0;
    setProgress((current / total) * 100);
  };

  const handleLoadedMetadata = () => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (media) setDuration(media.duration);
  };

  const handleSeek = (value: number[]) => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (!media) return;
    const seekTo = (value[0] / 100) * duration;
    media.currentTime = seekTo;
    setProgress(value[0]);
  };

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return "0:00";
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const handleLocalUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setIsRegisteringLocal(true);
    try {
      await mediaService.uploadLocalFile(file);
      event.target.value = "";
      await refreshLibrary();
    } catch (error) {
      console.error("Error uploading local file:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el archivo local.",
      );
    } finally {
      setIsRegisteringLocal(false);
    }
  };

  const handleDeleteLocal = async (file: PlayerMediaFile) => {
    if (file.source !== "local") {
      return;
    }
    if (!window.confirm(`¿Eliminar ${file.filename} de la biblioteca local?`)) {
      return;
    }
    setDeletingLocalId(file.id);
    try {
      await mediaService.deleteLocalFile(file.id);
      if (currentFile?.source === "local" && currentFile.id === file.id) {
        setCurrentFile(null);
      }
      await refreshLibrary();
    } catch (error) {
      console.error("Error deleting local media:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el archivo local.",
      );
    } finally {
      setDeletingLocalId(null);
    }
  };

  const handleSelectFile = (file: PlayerMediaFile) => {
    setCurrentFile(file);
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Reproductor Multimedia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {playerError && (
              <Alert variant="destructive">
                <AlertTitle>Reproducción no disponible</AlertTitle>
                <AlertDescription>{playerError}</AlertDescription>
              </Alert>
            )}

            {currentFile ? (
              <>
                <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                  {isVideo && currentUrl ? (
                    <video
                      ref={videoRef}
                      src={currentUrl ?? undefined}
                      className="w-full h-full object-contain"
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onEnded={() => setIsPlaying(false)}
                      controls={false}
                    />
                  ) : (
                    <>
                      <ImageWithFallback
                        src="https://images.unsplash.com/photo-1661922028028-e3c340d459d4?auto=format&fit=crop&w=1080&q=80"
                        alt="Audio waveform"
                        className="absolute inset-0 w-full h-full object-cover opacity-30"
                      />
                      <div className="relative z-10 flex items-center justify-center h-full">
                        {isVideo ? (
                          <Monitor className="w-24 h-24 text-white" />
                        ) : (
                          <Music className="w-24 h-24 text-white" />
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg">{currentFile.filename}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                    <Badge variant="secondary">
                      {currentFile.contentType.split("/")[1] || "unknown"}
                    </Badge>
                    <Badge variant="outline">
                      {currentFile.source === "local" ? "Local" : "Firebase"}
                    </Badge>
                    <span>{(currentFile.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                  {currentFile.source === "local" && currentFile.relativePath && (
                    <p className="text-xs text-gray-500 truncate">
                      /{currentFile.relativePath}
                    </p>
                  )}
                  {currentFile.source === "local" &&
                    currentFile.available === false && (
                      <p className="text-xs text-red-600">
                        El archivo no está disponible en el disco.
                      </p>
                    )}
                </div>

                <div className="space-y-2">
                  <Slider
                    value={[progress]}
                    onValueChange={handleSeek}
                    max={100}
                    step={0.1}
                    className="cursor-pointer"
                    disabled={!currentUrl}
                  />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{formatTime((progress / 100) * duration)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" disabled={!currentUrl}>
                      <SkipBack className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      onClick={togglePlay}
                      disabled={!currentUrl}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    <Button variant="outline" size="icon" disabled={!currentUrl}>
                      <SkipForward className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={toggleMute}>
                      {isMuted ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </Button>
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      onValueChange={(v) => setVolume(v[0])}
                      max={100}
                      step={1}
                      className="w-24"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Selecciona un archivo de la biblioteca para comenzar a
                reproducir.
              </div>
            )}

            {/* ✅ Hidden audio player */}
            {currentUrl && !isVideo && (
              <audio
                ref={audioRef}
                src={currentUrl ?? undefined}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ✅ Library */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Biblioteca Multimedia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              {isLibraryLoading ? (
                <p className="text-sm text-muted-foreground">
                  Cargando biblioteca...
                </p>
              ) : files.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay archivos disponibles todavía.
                </p>
              ) : (
                files.map((file) => {
                  const isActive =
                    currentFile?.id === file.id &&
                    currentFile?.source === file.source;

                  return (
                    <div
                      key={`${file.source}-${file.id}`}
                      onClick={() => handleSelectFile(file)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-gray-100"
                      } ${file.source === "local" && file.available === false ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="truncate font-medium">
                            {file.filename}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs opacity-80">
                            <Badge
                              variant={isActive ? "outline" : "secondary"}
                              className="text-[10px]"
                            >
                              {file.contentType.split("/")[1] || "unknown"}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {file.source === "local" ? "Local (servidor)" : "Firebase"}
                            </Badge>
                            <span>
                              {(file.size / 1024 / 1024).toFixed(1)} MB
                            </span>
                          </div>
                          {file.source === "local" && file.relativePath && (
                            <p className="text-[11px] opacity-70 truncate">
                              /{file.relativePath}
                            </p>
                          )}
                          {file.source === "local" &&
                            file.available === false && (
                              <p className="text-[11px] text-red-600">
                                No disponible en disco
                              </p>
                            )}
                        </div>
                        {file.source === "local" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-current hover:text-current"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteLocal(file);
                            }}
                            disabled={deletingLocalId === file.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-medium text-sm">Reproducir archivos locales</h4>
              </div>
              <div className="space-y-2">
                <Label htmlFor="local-inline-picker">Seleccionar archivos</Label>
                <Input
                  id="local-inline-picker"
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleLocalUpload}
                  disabled={isRegisteringLocal}
                />
                <p className="text-xs text-muted-foreground">
                  Se guardan en el servidor local para que puedas reproducirlos y convertirlos sin usar Firebase.
                </p>
                {isRegisteringLocal && (
                  <p className="text-xs text-muted-foreground">Registrando archivo...</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
