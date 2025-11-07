import React, { useCallback, useEffect, useMemo, useState } from "react";
import { mediaService } from "../services/mediaService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Slider } from "./ui/slider";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import {
  RefreshCw,
  CheckCircle,
  Download,
  Settings2,
  FileAudio,
  FileVideo,
  AlertTriangle,
} from "lucide-react";

type ConversionMode = "audio" | "video";

type MediaFile = {
  id: string;
  filename: string;
  storagePath: string;
  contentType?: string;
  size?: number;
  conversion?: {
    type?: ConversionMode;
    sourceFileId: string;
    targetFormat: string;
    bitrateKbps?: number;
    quality?: number;
    maxWidth?: number;
  };
};

type ConversionEntry = {
  id: string;
  mode: ConversionMode;
  fileName: string;
  sourceFormat: string;
  targetFormat: string;
  bitrateKbps?: number;
  quality?: number;
  maxWidth?: number | null;
  status: "processing" | "completed" | "error";
  startedAt: Date;
  completedAt?: Date;
  resultFile?: MediaFile;
  message?: string;
};

const audioFormats = ["mp3", "flac", "wav", "aac", "ogg"];
const videoFormats = ["mp4", "avi", "mkv"];
const AUDIO_BITRATE_RANGE = { min: 64, max: 320 };
const QUALITY_RANGE = { min: 0, max: 9 };
const VIDEO_BITRATE_RANGE = { min: 500, max: 8000 };
const VIDEO_WIDTH_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: "Original", value: null },
  { label: "1920 px (Full HD)", value: 1920 },
  { label: "1280 px (HD)", value: 1280 },
  { label: "854 px (SD)", value: 854 },
  { label: "640 px (Ligero)", value: 640 },
];

const getFileExtension = (filename?: string | null) => {
  if (!filename) {
    return null;
  }
  const parts = filename.split(".");
  if (parts.length < 2) {
    return null;
  }
  return parts.pop()?.toLowerCase() ?? null;
};

const isAudioFile = (file: MediaFile) => {
  if (file.contentType?.startsWith("audio/")) {
    return true;
  }
  const ext = getFileExtension(file.filename);
  return Boolean(ext && audioFormats.includes(ext));
};

const isVideoFile = (file: MediaFile) => {
  if (file.contentType?.startsWith("video/")) {
    return true;
  }
  const ext = getFileExtension(file.filename);
  return Boolean(ext && videoFormats.includes(ext));
};

export function FileConverter() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [mode, setMode] = useState<ConversionMode>("audio");
  const [selectedAudioFile, setSelectedAudioFile] = useState<MediaFile | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<MediaFile | null>(null);
  const [audioTargetFormat, setAudioTargetFormat] = useState<string>("mp3");
  const [videoTargetFormat, setVideoTargetFormat] = useState<string>("mp4");
  const [audioBitrate, setAudioBitrate] = useState<number>(192);
  const [audioQuality, setAudioQuality] = useState<number>(2);
  const [videoBitrate, setVideoBitrate] = useState<number>(2500);
  const [videoMaxWidth, setVideoMaxWidth] = useState<number | null>(1280);
  const [history, setHistory] = useState<ConversionEntry[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioFiles = useMemo(() => files.filter(isAudioFile), [files]);
  const videoFiles = useMemo(() => files.filter(isVideoFile), [files]);

  const loadFiles = useCallback(async () => {
    try {
      setIsLoadingFiles(true);
      setErrorMessage(null);
      const [myFiles, sharedFiles] = await Promise.all([
        mediaService.getMyFiles(),
        mediaService.getSharedWithMe(),
      ]);
      const allFiles = [...(myFiles || []), ...(sharedFiles || [])] as MediaFile[];
      setFiles(allFiles);
      if (allFiles.length === 0) {
        setSelectedAudioFile(null);
        setSelectedVideoFile(null);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los archivos multimedia.";
      setErrorMessage(message);
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (audioFiles.length === 0) {
      setSelectedAudioFile(null);
      return;
    }
    if (!selectedAudioFile) {
      setSelectedAudioFile(audioFiles[0]);
      return;
    }
    const exists = audioFiles.some((file) => file.id === selectedAudioFile.id);
    if (!exists) {
      setSelectedAudioFile(audioFiles[0]);
    }
  }, [audioFiles, selectedAudioFile]);

  useEffect(() => {
    if (videoFiles.length === 0) {
      setSelectedVideoFile(null);
      return;
    }
    if (!selectedVideoFile) {
      setSelectedVideoFile(videoFiles[0]);
      return;
    }
    const exists = videoFiles.some((file) => file.id === selectedVideoFile.id);
    if (!exists) {
      setSelectedVideoFile(videoFiles[0]);
    }
  }, [videoFiles, selectedVideoFile]);

  const resetAudioSettings = () => {
    setAudioBitrate(192);
    setAudioQuality(2);
  };

  const resetVideoSettings = () => {
    setVideoBitrate(2500);
    setVideoMaxWidth(1280);
  };

  const activeFiles = mode === "audio" ? audioFiles : videoFiles;
  const selectedFile = mode === "audio" ? selectedAudioFile : selectedVideoFile;
  const targetFormat = mode === "audio" ? audioTargetFormat : videoTargetFormat;
  const selectedFormat = selectedFile ? getFileExtension(selectedFile.filename) : null;
  const sameFormat = Boolean(selectedFile && selectedFormat === targetFormat);
  const noFiles = activeFiles.length === 0;

  const enqueueStatus = (
    updater: (entry: ConversionEntry) => ConversionEntry,
    id: string,
  ) => {
    setHistory((prev) =>
      prev.map((entry) => (entry.id === id ? updater(entry) : entry)),
    );
  };

  const handleConvert = async () => {
    if (!selectedFile) {
      return;
    }

    const entryId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Date.now().toString();

    const newEntry: ConversionEntry = {
      id: entryId,
      mode,
      fileName: selectedFile.filename,
      sourceFormat: selectedFormat ?? mode,
      targetFormat,
      bitrateKbps: mode === "audio" ? audioBitrate : videoBitrate,
      quality: mode === "audio" ? audioQuality : undefined,
      maxWidth: mode === "video" ? videoMaxWidth : undefined,
      status: "processing",
      startedAt: new Date(),
    };

    setHistory((prev) => [newEntry, ...prev]);
    setIsConverting(true);
    setErrorMessage(null);

    try {
      const response =
        mode === "audio"
          ? await mediaService.convertAudio(selectedFile.id, {
              targetFormat,
              bitrateKbps: audioBitrate,
              quality: audioQuality,
            })
          : await mediaService.convertVideo(selectedFile.id, {
              targetFormat,
              bitrateKbps: videoBitrate,
              maxWidth: videoMaxWidth,
            });

      enqueueStatus(
        (entry) => ({
          ...entry,
          status: "completed",
          completedAt: new Date(),
          resultFile: (response as { file?: MediaFile }).file,
          message:
            (response as { message?: string }).message ??
            "Conversión completada",
        }),
        entryId,
      );

      await loadFiles();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo completar la conversión.";
      enqueueStatus(
        (entry) => ({
          ...entry,
          status: "error",
          completedAt: new Date(),
          message,
        }),
        entryId,
      );
      setErrorMessage(message);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = async (file: MediaFile) => {
    if (!file.id) {
      return;
    }
    setDownloadingId(file.id);
    try {
      await mediaService.downloadFile(file.id, file.filename);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo descargar el archivo convertido.";
      setErrorMessage(message);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatStatusStyles = (status: ConversionEntry["status"]) => {
    switch (status) {
      case "completed":
        return "default";
      case "processing":
        return "secondary";
      case "error":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Conversión multimedia en servidor</CardTitle>
              <CardDescription>
                Transcodifica audio o video desde Firebase Storage usando FFmpeg
                distribuido.
              </CardDescription>
            </div>
            <div className="rounded-md border bg-muted/60 p-1 text-xs font-medium">
              Último modo: {mode === "audio" ? "Audio" : "Video"}
            </div>
          </div>
          <div className="flex gap-2 rounded-md border bg-muted/30 p-1">
            <Button
              variant={mode === "audio" ? "default" : "ghost"}
              className="flex-1"
              onClick={() => setMode("audio")}
            >
              <FileAudio className="mr-2 h-4 w-4" />
              Audio
            </Button>
            <Button
              variant={mode === "video" ? "default" : "ghost"}
              className="flex-1"
              onClick={() => setMode("video")}
            >
              <FileVideo className="mr-2 h-4 w-4" />
              Video
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm text-muted-foreground">
                {mode === "audio"
                  ? "Archivos de audio disponibles"
                  : "Archivos de video disponibles"}
              </p>
              <p className="text-lg font-semibold">
                {mode === "audio" ? audioFiles.length : videoFiles.length}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadFiles()}
              disabled={isLoadingFiles}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isLoadingFiles ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <p>{errorMessage}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Archivo de origen</label>
            <Select
              value={selectedFile?.id ?? ""}
              onValueChange={(value) => {
                const file = activeFiles.find((f) => String(f.id) === value);
                if (mode === "audio") {
                  setSelectedAudioFile(file ?? null);
                } else {
                  setSelectedVideoFile(file ?? null);
                }
              }}
              disabled={noFiles}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    mode === "audio"
                      ? "Seleccionar archivo de audio"
                      : "Seleccionar archivo de video"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {activeFiles.length === 0 ? (
                  <SelectItem value="none" disabled>
                    {mode === "audio"
                      ? "No hay archivos de audio disponibles"
                      : "No hay archivos de video disponibles"}
                  </SelectItem>
                ) : (
                  activeFiles.map((file) => (
                    <SelectItem key={file.id} value={file.id}>
                      {file.filename}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                Formato actual:{" "}
                <span className="uppercase">
                  {selectedFormat ?? selectedFile.contentType ?? "desconocido"}
                </span>{" "}
                · Tamaño:{" "}
                {selectedFile.size
                  ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                  : "N/D"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Formato destino</label>
            <Select
              value={targetFormat}
              onValueChange={(value) =>
                mode === "audio"
                  ? setAudioTargetFormat(value)
                  : setVideoTargetFormat(value)
              }
              disabled={noFiles}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar formato" />
              </SelectTrigger>
              <SelectContent>
                {(mode === "audio" ? audioFormats : videoFormats).map((format) => (
                  <SelectItem key={format} value={format}>
                    {format.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sameFormat && (
              <p className="text-xs text-amber-600">
                El archivo ya está en formato {targetFormat.toUpperCase()}.
                Selecciona otro formato para continuar.
              </p>
            )}
          </div>

          <div className="grid gap-4 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Parámetros de salida</p>
            </div>

            {mode === "audio" ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Bitrate</span>
                    <span className="font-semibold">{audioBitrate} kbps</span>
                  </div>
                  <Slider
                    value={[audioBitrate]}
                    min={AUDIO_BITRATE_RANGE.min}
                    max={AUDIO_BITRATE_RANGE.max}
                    step={16}
                    onValueChange={(values) => {
                      if (values[0]) {
                        setAudioBitrate(Math.round(values[0]));
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Valores recomendados: 128 kbps (normal), 192 kbps (alta
                    fidelidad), 256+ kbps (máxima calidad).
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Calidad (VBR)</span>
                    <span className="font-semibold">Nivel {audioQuality}</span>
                  </div>
                  <Slider
                    value={[audioQuality]}
                    min={QUALITY_RANGE.min}
                    max={QUALITY_RANGE.max}
                    step={1}
                    onValueChange={(values) => {
                      if (values[0] !== undefined) {
                        setAudioQuality(Math.round(values[0]));
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = mejor calidad / mayor tamaño. 9 = menor calidad / menor
                    tamaño.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={resetAudioSettings}>
                    Restaurar valores
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Bitrate de video</span>
                    <span className="font-semibold">{videoBitrate} kbps</span>
                  </div>
                  <Slider
                    value={[videoBitrate]}
                    min={VIDEO_BITRATE_RANGE.min}
                    max={VIDEO_BITRATE_RANGE.max}
                    step={100}
                    onValueChange={(values) => {
                      if (values[0]) {
                        setVideoBitrate(Math.round(values[0]));
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Reduce el bitrate para comprimir. 2500 kbps ≈ HD, 5000 kbps ≈
                    Full HD.
                  </p>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Reducción de ancho máximo
                  </label>
                  <Select
                    value={videoMaxWidth === null ? "original" : String(videoMaxWidth)}
                    onValueChange={(value) => {
                      if (value === "original") {
                        setVideoMaxWidth(null);
                        return;
                      }
                      const num = Number(value);
                      setVideoMaxWidth(Number.isNaN(num) ? null : num);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Mantener resolución original" />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_WIDTH_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.label}
                          value={
                            option.value === null ? "original" : String(option.value)
                          }
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Limitar el ancho ayuda a reducir el tamaño del archivo manteniendo
                    la relación de aspecto.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={resetVideoSettings}>
                    Restaurar valores
                  </Button>
                </div>
              </>
            )}
          </div>

          <Button
            className="w-full"
            onClick={() => void handleConvert()}
            disabled={isConverting || !selectedFile || sameFormat || noFiles}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isConverting ? "animate-spin" : ""}`}
            />
            {isConverting ? "Convirtiendo..." : "Iniciar conversión"}
          </Button>

          {noFiles && (
            <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              {mode === "audio" ? (
                <FileAudio className="h-4 w-4" />
              ) : (
                <FileVideo className="h-4 w-4" />
              )}
              {mode === "audio"
                ? "Sube un archivo de audio en la pestaña “Reproductor” para habilitar el convertidor."
                : "Sube un archivo de video para habilitar la conversión con compresión."}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de conversiones</CardTitle>
          <CardDescription>
            Seguimiento de conversiones ejecutadas en el clúster de MediaStream.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {history.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aún no hay conversiones. Selecciona un archivo y presiona “Iniciar
              conversión”.
            </div>
          )}

          {history.map((entry) => (
            <div key={entry.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{entry.fileName}</p>
                    <Badge variant="outline" className="uppercase">
                      {entry.mode}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {entry.sourceFormat?.toUpperCase()} →{" "}
                    {entry.targetFormat.toUpperCase()}
                  </p>
                </div>
                <Badge variant={formatStatusStyles(entry.status)}>
                  {entry.status === "completed" && (
                    <CheckCircle className="mr-1 h-3.5 w-3.5" />
                  )}
                  {entry.status === "processing" && (
                    <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                  )}
                  {entry.status}
                </Badge>
              </div>

              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <p>
                  Bitrate:{" "}
                  {entry.bitrateKbps ? `${entry.bitrateKbps} kbps` : "N/D"}
                </p>
                {entry.mode === "audio" ? (
                  <p>Calidad VBR: {entry.quality ?? "N/D"}</p>
                ) : (
                  <p>
                    Máx. ancho:{" "}
                    {entry.maxWidth ? `${entry.maxWidth}px` : "Original"}
                  </p>
                )}
                <p>
                  Inicio:{" "}
                  {entry.startedAt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p>
                  {entry.completedAt
                    ? `Fin: ${entry.completedAt.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : "Procesando..."}
                </p>
              </div>

              {entry.status === "processing" && <Progress value={70} />}

              {entry.message && (
                <p
                  className={`text-sm ${
                    entry.status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {entry.message}
                </p>
              )}

              {entry.resultFile && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 p-3 text-sm">
                  <div>
                    <p className="font-medium">{entry.resultFile.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {(entry.resultFile.size
                        ? (entry.resultFile.size / 1024 / 1024).toFixed(2)
                        : "N/D") + " MB"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleDownload(entry.resultFile!)}
                    disabled={downloadingId === entry.resultFile.id}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {downloadingId === entry.resultFile.id
                      ? "Descargando..."
                      : "Descargar"}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
