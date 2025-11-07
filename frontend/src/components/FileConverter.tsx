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
  AlertTriangle,
} from "lucide-react";

type MediaFile = {
  id: string;
  filename: string;
  storagePath: string;
  contentType?: string;
  size?: number;
  conversion?: {
    sourceFileId: string;
    targetFormat: string;
    bitrateKbps: number;
    quality?: number;
  };
};

type ConversionEntry = {
  id: string;
  fileName: string;
  sourceFormat: string;
  targetFormat: string;
  bitrateKbps: number;
  quality: number;
  status: "processing" | "completed" | "error";
  startedAt: Date;
  completedAt?: Date;
  resultFile?: MediaFile;
  message?: string;
};

const audioFormats = ["mp3", "flac", "wav", "aac", "ogg"];
const BITRATE_RANGE = { min: 64, max: 320 };
const QUALITY_RANGE = { min: 0, max: 9 };

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

export function FileConverter() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [targetFormat, setTargetFormat] = useState<string>("mp3");
  const [bitrate, setBitrate] = useState<number>(192);
  const [quality, setQuality] = useState<number>(2);
  const [history, setHistory] = useState<ConversionEntry[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioFiles = useMemo(() => files.filter(isAudioFile), [files]);

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
        setSelectedFile(null);
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
      if (selectedFile !== null) {
        setSelectedFile(null);
      }
      return;
    }

    if (!selectedFile) {
      setSelectedFile(audioFiles[0]);
      return;
    }

    const exists = audioFiles.some((file) => file.id === selectedFile.id);
    if (!exists) {
      setSelectedFile(audioFiles[0]);
    }
  }, [audioFiles, selectedFile]);

  const resetSettings = () => {
    setBitrate(192);
    setQuality(2);
  };

  const selectedFormat = selectedFile ? getFileExtension(selectedFile.filename) : null;
  const sameFormat = Boolean(selectedFormat && selectedFormat === targetFormat);
  const noAudioFiles = audioFiles.length === 0;

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
      fileName: selectedFile.filename,
      sourceFormat: selectedFormat ?? "audio",
      targetFormat,
      bitrateKbps: bitrate,
      quality,
      status: "processing",
      startedAt: new Date(),
    };
    setHistory((prev) => [newEntry, ...prev]);
    setIsConverting(true);
    setErrorMessage(null);

    try {
      const response = (await mediaService.convertAudio(selectedFile.id, {
        targetFormat,
        bitrateKbps: bitrate,
        quality,
      })) as { message?: string; file?: MediaFile };

      enqueueStatus(
        (entry) => ({
          ...entry,
          status: "completed",
          completedAt: new Date(),
          resultFile: response.file,
          message: response.message ?? "Conversión completada",
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
        <CardHeader>
          <CardTitle>Conversión de Audio en Servidor</CardTitle>
          <CardDescription>
            Convierte archivos FLAC, WAV, MP3, AAC u OGG con control de bitrate y
            calidad, sin salir del navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm text-muted-foreground">
                Archivos disponibles
              </p>
              <p className="text-lg font-semibold">{audioFiles.length}</p>
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
                const file = audioFiles.find((f) => String(f.id) === value);
                setSelectedFile(file ?? null);
              }}
              disabled={audioFiles.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar archivo de audio" />
              </SelectTrigger>
              <SelectContent>
                {audioFiles.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No hay archivos de audio disponibles
                  </SelectItem>
                ) : (
                  audioFiles.map((file) => (
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
              onValueChange={setTargetFormat}
              disabled={noAudioFiles}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar formato" />
              </SelectTrigger>
              <SelectContent>
                {audioFormats.map((format) => (
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

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Bitrate</span>
                <span className="font-semibold">{bitrate} kbps</span>
              </div>
              <Slider
                value={[bitrate]}
                min={BITRATE_RANGE.min}
                max={BITRATE_RANGE.max}
                step={16}
                onValueChange={(values) => {
                  if (values[0]) {
                    setBitrate(Math.round(values[0]));
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Valores recomendados: 128 kbps (normal), 192 kbps (calidad alta),
                256+ kbps (máxima fidelidad).
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Calidad (VBR)</span>
                <span className="font-semibold">Nivel {quality}</span>
              </div>
              <Slider
                value={[quality]}
                min={QUALITY_RANGE.min}
                max={QUALITY_RANGE.max}
                step={1}
                onValueChange={(values) => {
                  if (values[0] !== undefined) {
                    setQuality(Math.round(values[0]));
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                0 = mejor calidad / mayor tamaño. 9 = menor calidad / menor
                tamaño.
              </p>
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetSettings}>
                Restaurar valores
              </Button>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => void handleConvert()}
            disabled={
              isConverting || !selectedFile || sameFormat || noAudioFiles
            }
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isConverting ? "animate-spin" : ""}`}
            />
            {isConverting ? "Convirtiendo..." : "Iniciar conversión"}
          </Button>

          {noAudioFiles && (
            <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <FileAudio className="h-4 w-4" />
              Sube un archivo de audio en la pestaña “Reproductor” para habilitar
              el convertidor.
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
                  <p className="font-semibold">{entry.fileName}</p>
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
                <p>Bitrate: {entry.bitrateKbps} kbps</p>
                <p>Calidad VBR: {entry.quality}</p>
                <p>
                  Inicio: {entry.startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
