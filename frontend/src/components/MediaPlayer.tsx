import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Badge } from "./ui/badge";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Monitor,
  Music,
} from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { mediaService } from "../services/mediaService";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../lib/firebaseClient";

interface MediaFile {
  id: string;
  filename: string;
  storagePath: string;
  contentType: string;
  size: number;
  duration?: string;
}

export function MediaPlayer() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [currentFile, setCurrentFile] = useState<MediaFile | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isVideo = currentFile?.contentType.includes("video");

  // ✅ Load files when component mounts
  useEffect(() => {
    const fetchFiles = async () => {
      const [myFiles, sharedFiles] = await Promise.all([
        mediaService.getMyFiles(),
        mediaService.getSharedWithMe(),
      ]);
      const all = [...myFiles, ...sharedFiles];
      setFiles(all);
      if (all.length > 0) setCurrentFile(all[0]);
    };
    fetchFiles();
  }, []);

  // ✅ When file changes, get Firebase URL
  useEffect(() => {
    const fetchUrl = async () => {
      if (!currentFile) return;
      try {
        const fileRef = ref(storage, currentFile.storagePath);
        const url = await getDownloadURL(fileRef);
        setCurrentUrl(url);
        setIsPlaying(false);
        setProgress(0);
      } catch (err) {
        console.error("Error fetching file URL:", err);
      }
    };
    fetchUrl();
  }, [currentFile]);

  // ✅ Handle play/pause logic
  useEffect(() => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (!media) return;
    if (isPlaying) media.play();
    else media.pause();
  }, [isPlaying, isVideo]);

  // ✅ Handle volume and mute
  useEffect(() => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (!media) return;
    media.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted, isVideo]);

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

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Reproductor Multimedia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentFile && (
              <>
                <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                  {isVideo && currentUrl ? (
                    <video
                      ref={videoRef}
                      src={currentUrl}
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

                <div>
                  <h3 className="text-lg">{currentFile.filename}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Badge variant="secondary">
                      {currentFile.contentType.split("/")[1] || "unknown"}
                    </Badge>
                    <span>{(currentFile.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Slider
                    value={[progress]}
                    onValueChange={handleSeek}
                    max={100}
                    step={0.1}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{formatTime((progress / 100) * duration)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon">
                      <SkipBack className="w-4 h-4" />
                    </Button>
                    <Button size="icon" onClick={togglePlay}>
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    <Button variant="outline" size="icon">
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
            )}

            {/* ✅ Hidden audio player */}
            {currentUrl && !isVideo && (
              <audio
                ref={audioRef}
                src={currentUrl}
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
          <CardContent className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                onClick={() => setCurrentFile(file)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  currentFile?.id === file.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-gray-100"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{file.filename}</p>
                    <div className="flex items-center gap-2 text-sm opacity-80 mt-1">
                      <Badge
                        variant={
                          currentFile?.id === file.id ? "outline" : "secondary"
                        }
                        className="text-xs"
                      >
                        {file.contentType.split("/")[1] || "unknown"}
                      </Badge>
                      <span className="text-xs">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
