// src/components/FileConverter.tsx
import React, { useEffect, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../lib/firebaseClient";
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
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import {
  RefreshCw,
  CheckCircle,
  FileAudio,
  FileVideo,
  ArrowRight,
  Download,
} from "lucide-react";

type MediaFile = {
  id: string;
  filename: string;
  storagePath: string;
  contentType?: string;
  size?: number;
};

type ConversionTask = {
  id: string;
  fileName: string;
  fromFormat: string;
  toFormat: string;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  convertedSize: string;
  node: string;
  downloadUrl?: string;
};

const audioFormats = ["MP3", "FLAC", "WAV", "AAC", "OGG"];
const videoFormats = ["MP4", "AVI", "MKV", "MOV", "WEBM"];

// ✅ single ffmpeg instance
const ffmpeg = new FFmpeg();

export function FileConverter() {
  const [mediaType, setMediaType] = useState<"audio" | "video">("audio");
  const [fromFormat, setFromFormat] = useState("WAV");
  const [toFormat, setToFormat] = useState("MP3");
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [tasks, setTasks] = useState<ConversionTask[]>([]);
  const [loading, setLoading] = useState(false);

  const formats = mediaType === "audio" ? audioFormats : videoFormats;

  // ✅ Load user's files
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const [myFiles, sharedFiles] = await Promise.all([
          mediaService.getMyFiles(),
          mediaService.getSharedWithMe(),
        ]);
        const all = [...(myFiles || []), ...(sharedFiles || [])];
        setFiles(all);
        if (all.length > 0) setSelectedFile(all[0]);
        console.log(all)
      } catch (err) {
        console.error("Error loading media files:", err);
      }
    };
    fetchFiles();
  }, []);

  // ✅ Load FFmpeg core once
  async function ensureFFmpegLoaded() {
    if (!ffmpeg.loaded) {
      await ffmpeg.load({
        coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js",
      });
      console.log("✅ FFmpeg loaded");
    }
  }

  const handleConvert = async () => {
    if (!selectedFile) {
      console.warn("No file selected");
      return;
    }

    const taskId = Date.now().toString();
    const newTask: ConversionTask = {
      id: taskId,
      fileName: selectedFile.name,
      fromFormat,
      toFormat,
      status: "pending",
      progress: 0,
      convertedSize: "--",
      node: "Browser",
    };
    setTasks((prev) => [newTask, ...prev]);
    setLoading(true);

    try {
      await ensureFFmpegLoaded();

      const fileRef = ref(storage, selectedFile.storagePath);
      const downloadURL = await getDownloadURL(fileRef);

      setTasks((s) =>
        s.map((t) =>
          t.id === taskId ? { ...t, status: "processing", progress: 20 } : t
        )
      );

      const inputName = `input.${fromFormat.toLowerCase()}`;
      const outputName = `output.${toFormat.toLowerCase()}`;

      // ✅ Fetch & write input file
      const fileData = await fetchFile(downloadURL);
      await ffmpeg.writeFile(inputName, fileData);

      setTasks((s) =>
        s.map((t) => (t.id === taskId ? { ...t, progress: 35 } : t))
      );

      // ✅ Run conversion
      await ffmpeg.exec(["-i", inputName, outputName]);

      setTasks((s) =>
        s.map((t) => (t.id === taskId ? { ...t, progress: 80 } : t))
      );

      // ✅ Read output
      const outputData = await ffmpeg.readFile(outputName);
      const blob = new Blob([outputData as Uint8Array], {
        type:
          mediaType === "video"
            ? `video/${toFormat.toLowerCase()}`
            : `audio/${toFormat.toLowerCase()}`,
      });

      const url = URL.createObjectURL(blob);

      setTasks((s) =>
        s.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "completed",
                progress: 100,
                convertedSize: `${(blob.size / 1024 / 1024).toFixed(1)} MB`,
                downloadUrl: url,
              }
            : t
        )
      );
    } catch (err) {
      console.error("Conversion failed:", err);
      setTasks((s) =>
        s.map((t) =>
          t.id === taskId ? { ...t, status: "error", progress: 0 } : t
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: ConversionTask["status"]) => {
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
    <div className="grid lg:grid-cols-2 gap-6">
      {/* LEFT: Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Convertir Archivos</CardTitle>
          <CardDescription>
            Convierte archivos desde Firebase Storage en el navegador
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Media Type */}
          <div className="space-y-2">
            <label className="text-sm">Tipo de medio</label>
            <div className="flex gap-2">
              <Button
                variant={mediaType === "audio" ? "default" : "outline"}
                onClick={() => setMediaType("audio")}
                className="flex-1"
              >
                <FileAudio className="w-4 h-4 mr-2" /> Audio
              </Button>
              <Button
                variant={mediaType === "video" ? "default" : "outline"}
                onClick={() => setMediaType("video")}
                className="flex-1"
              >
                <FileVideo className="w-4 h-4 mr-2" /> Video
              </Button>
            </div>
          </div>

          {/* File Select */}
          <div className="space-y-2">
            <label className="text-sm">Archivo (Firebase)</label>
            <Select
              value={selectedFile?.id ?? ""}
              onValueChange={(val) => {
                const found = files.find((f) => String(f.id) === val);
                setSelectedFile(found ?? null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar archivo" />
              </SelectTrigger>

              <SelectContent>
                {files.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No se encontraron archivos
                  </SelectItem>
                ) : (
                  files.map((f, i) => (
                    <SelectItem key={f.id ?? i} value={String(f.id ?? i)}>
                      {f.filename ||
                        f.storagePath?.split("/").pop() ||
                        "Archivo sin nombre"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Format selectors */}
          <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm">Formato origen</label>
              <Select value={fromFormat} onValueChange={setFromFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Origen" />
                </SelectTrigger>
                <SelectContent>
                  {formats.map((fmt) => (
                    <SelectItem key={fmt} value={fmt}>
                      {fmt}
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
                  <SelectValue placeholder="Destino" />
                </SelectTrigger>
                <SelectContent>
                  {formats.map((fmt) => (
                    <SelectItem key={fmt} value={fmt}>
                      {fmt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleConvert}
            disabled={loading || !selectedFile}
            className="w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {loading ? "Procesando..." : "Iniciar Conversión"}
          </Button>
        </CardContent>
      </Card>

      {/* RIGHT: Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Tareas de Conversión</CardTitle>
          <CardDescription>
            Estado de conversiones en el navegador
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tasks.length === 0 && (
              <p className="text-sm text-gray-500">No hay tareas</p>
            )}

            {tasks.map((t) => (
              <div key={t.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{t.fileName}</p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                      <span>
                        {t.fromFormat} → {t.toFormat}
                      </span>
                      <Badge variant="outline">{t.node}</Badge>
                    </div>
                  </div>
                  <Badge variant={getStatusColor(t.status)}>
                    {t.status === "completed" && (
                      <CheckCircle className="w-3 h-3 mr-1" />
                    )}
                    {t.status === "processing" && (
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    )}
                    {t.status}
                  </Badge>
                </div>

                {t.status !== "completed" && (
                  <div className="space-y-1">
                    <Progress value={t.progress} />
                    <p className="text-xs text-gray-500">
                      {t.progress}% completado
                    </p>
                  </div>
                )}

                {t.downloadUrl && (
                  <div className="flex justify-end">
                    <a
                      href={t.downloadUrl}
                      download={t.fileName.replace(
                        /\.\w+$/,
                        `.${t.toFormat.toLowerCase()}`
                      )}
                      className="inline-flex items-center gap-2 text-blue-600"
                    >
                      <Download className="w-4 h-4" /> Descargar
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    Tamaño convertido: {t.convertedSize}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
