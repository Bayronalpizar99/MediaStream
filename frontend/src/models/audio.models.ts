export interface AudioFile {
  name: string;
  size: number;
  format: string;
  mimeType: string;
  url: string;
}

export interface AudioListResponse {
  message: string;
  items: AudioFile[];
}

export interface AudioUploadResponse {
  message: string;
  item: AudioFile;
}
