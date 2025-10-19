import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Monitor, Music } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface MediaFile {
  id: string;
  name: string;
  format: string;
  duration: string;
  size: string;
  location: 'local' | 'remote';
  node?: string;
}

const mockFiles: MediaFile[] = [
  { id: '1', name: 'Summer Vibes', format: 'MP3', duration: '3:45', size: '4.2 MB', location: 'local' },
  { id: '2', name: 'Jazz Night', format: 'FLAC', duration: '5:12', size: '48 MB', location: 'remote', node: 'Node-01' },
  { id: '3', name: 'Tutorial React', format: 'MP4', duration: '12:30', size: '125 MB', location: 'remote', node: 'Node-02' },
  { id: '4', name: 'Classical Symphony', format: 'WAV', duration: '8:20', size: '92 MB', location: 'local' },
  { id: '5', name: 'Conference Recording', format: 'MP4', duration: '45:15', size: '450 MB', location: 'remote', node: 'Node-03' },
];

export function MediaPlayer() {
  const [currentFile, setCurrentFile] = useState<MediaFile>(mockFiles[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState([33]);
  const [volume, setVolume] = useState([75]);
  const [isMuted, setIsMuted] = useState(false);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const toggleMute = () => setIsMuted(!isMuted);

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Reproductor Multimedia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="aspect-video bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center relative overflow-hidden">
              <ImageWithFallback 
                src="https://images.unsplash.com/photo-1661922028028-e3c340d459d4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhdWRpbyUyMHdhdmVmb3JtJTIwbXVzaWN8ZW58MXx8fHwxNzYwNTc1OTIyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Audio waveform"
                className="absolute inset-0 w-full h-full object-cover opacity-30"
              />
              <div className="relative z-10">
                {currentFile.format === 'MP4' ? (
                  <Monitor className="w-24 h-24 text-white" />
                ) : (
                  <Music className="w-24 h-24 text-white" />
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg">{currentFile.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Badge variant={currentFile.location === 'local' ? 'default' : 'secondary'}>
                      {currentFile.location === 'local' ? 'Local' : `Remoto - ${currentFile.node}`}
                    </Badge>
                    <span>{currentFile.format}</span>
                    <span>•</span>
                    <span>{currentFile.duration}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Slider
                  value={progress}
                  onValueChange={setProgress}
                  max={100}
                  step={1}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>1:23</span>
                  <span>{currentFile.duration}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="icon">
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button size="icon" onClick={togglePlay}>
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="icon">
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={toggleMute}>
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Slider
                  value={isMuted ? [0] : volume}
                  onValueChange={setVolume}
                  max={100}
                  step={1}
                  className="w-24"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>Biblioteca Multimedia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mockFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => setCurrentFile(file)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  currentFile.id === file.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-sm opacity-80 mt-1">
                      <Badge variant={currentFile.id === file.id ? 'outline' : 'secondary'} className="text-xs">
                        {file.format}
                      </Badge>
                      <span className="text-xs">{file.duration}</span>
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
