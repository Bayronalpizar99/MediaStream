import { 
  API_CONFIG, 
  HTTP_METHODS, 
  CONTENT_TYPES 
} from '../constants';
import { authService } from './authService';

const getApiUrl = (endpoint: string) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

export type LocalMediaResponse = {
  id: string;
  filename: string;
  filePath: string;
  relativePath: string;
  contentType: string;
  mediaType: 'audio' | 'video';
  size: number;
  available: boolean;
  source: 'local';
  conversion?: {
    type: 'audio' | 'video';
    sourceLocalId: string;
    targetFormat: string;
    bitrateKbps?: number;
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
  };
};

const getMyFiles = async () => {
  const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MEDIA.MY_FILES), {
    method: HTTP_METHODS.GET,
    cache: 'no-store', 
    headers: {
      ...authService.getSessionHeaders(),
      'Accept': CONTENT_TYPES.JSON, 
    },
  });
  if (!response.ok) throw new Error('Error fetching user files');
  return await response.json();
};


const getSharedWithMe = async () => {
  const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MEDIA.SHARED_WITH_ME), {
    method: HTTP_METHODS.GET,
    cache: 'no-store', 
    headers: {
      ...authService.getSessionHeaders(),
      'Accept': CONTENT_TYPES.JSON,
    },
  });
  if (!response.ok) throw new Error('Error fetching shared files');
  return await response.json();
};

const uploadFile = async (file: File) => {
  const authHeaders = authService.getSessionHeaders();
  const formData = new FormData();
  formData.append('file', file); 

  const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MEDIA.UPLOAD), {
    method: HTTP_METHODS.POST,
    headers: authHeaders, 
    body: formData,
  });
  if (!response.ok) throw new Error('Error uploading file');
  return await response.json();
};

const shareFile = async (fileId: string, email: string) => {
  const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MEDIA.SHARE(fileId)), {
    method: HTTP_METHODS.POST,
    headers: {
      ...authService.getSessionHeaders(),
      'Content-Type': CONTENT_TYPES.JSON,
    },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw new Error('Error sharing file');
  return await response.json();
};


const deleteFile = async (fileId: string) => {
  const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MEDIA.DELETE(fileId)), {
    method: HTTP_METHODS.DELETE,
    headers: {
      ...authService.getSessionHeaders(),
    },
  });
  if (!response.ok) throw new Error('Error deleting file');
  return await response.json();
};

const getLocalFiles = async (): Promise<LocalMediaResponse[]> => {
  const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MEDIA.LOCAL.BASE), {
    method: HTTP_METHODS.GET,
    cache: 'no-store',
    headers: {
      ...authService.getSessionHeaders(),
      Accept: CONTENT_TYPES.JSON,
    },
  });

  if (!response.ok) {
    throw new Error('Error fetching local files');
  }

  return await response.json();
};

const uploadLocalFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MEDIA.LOCAL.UPLOAD), {
    method: HTTP_METHODS.POST,
    headers: {
      ...authService.getSessionHeaders(),
    },
    body: formData,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? 'Error uploading local file';
    throw new Error(message);
  }

  return data as LocalMediaResponse;
};

const deleteLocalFile = async (localId: string) => {
  const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MEDIA.LOCAL.DELETE(localId)), {
    method: HTTP_METHODS.DELETE,
    headers: {
      ...authService.getSessionHeaders(),
      Accept: CONTENT_TYPES.JSON,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? 'Error deleting local file';
    throw new Error(message);
  }

  return data;
};

const getLocalStream = async (localId: string) => {
  const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MEDIA.LOCAL.STREAM(localId)), {
    method: HTTP_METHODS.GET,
    cache: 'no-store',
    headers: {
      ...authService.getSessionHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error('Error retrieving local file');
  }

  return await response.blob();
};

const downloadLocalFile = async (localId: string, filename: string) => {
  const blob = await getLocalStream(localId);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};


const downloadFile = async (fileId: string, filename: string) => {
  const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MEDIA.DOWNLOAD(fileId)), {
    method: HTTP_METHODS.GET,
    headers: {
      ...authService.getSessionHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error('Error downloading file');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

interface AudioConversionPayload {
  targetFormat: string;
  bitrateKbps?: number;
  quality?: number;
}

const convertAudio = async (fileId: string, payload: AudioConversionPayload) => {
  const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MEDIA.CONVERT(fileId)), {
    method: HTTP_METHODS.POST,
    headers: {
      ...authService.getSessionHeaders(),
      'Content-Type': CONTENT_TYPES.JSON,
      'Accept': CONTENT_TYPES.JSON,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? 'Error converting audio file';
    throw new Error(message);
  }

  return data;
};

interface VideoConversionPayload {
  targetFormat: string;
  bitrateKbps?: number;
  maxWidth?: number | null;
  maxHeight?: number | null;
}

const convertVideo = async (fileId: string, payload: VideoConversionPayload) => {
  const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MEDIA.CONVERT_VIDEO(fileId)), {
    method: HTTP_METHODS.POST,
    headers: {
      ...authService.getSessionHeaders(),
      'Content-Type': CONTENT_TYPES.JSON,
      'Accept': CONTENT_TYPES.JSON,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? 'Error converting video file';
    throw new Error(message);
  }

  return data;
};

const convertLocalAudio = async (localId: string, payload: AudioConversionPayload) => {
  const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MEDIA.LOCAL.CONVERT_AUDIO(localId)), {
    method: HTTP_METHODS.POST,
    headers: {
      ...authService.getSessionHeaders(),
      'Content-Type': CONTENT_TYPES.JSON,
      Accept: CONTENT_TYPES.JSON,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? 'Error converting local audio file';
    throw new Error(message);
  }

  return data;
};

const convertLocalVideo = async (localId: string, payload: VideoConversionPayload) => {
  const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.MEDIA.LOCAL.CONVERT_VIDEO(localId)), {
    method: HTTP_METHODS.POST,
    headers: {
      ...authService.getSessionHeaders(),
      'Content-Type': CONTENT_TYPES.JSON,
      Accept: CONTENT_TYPES.JSON,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (data as { message?: string } | null)?.message ?? 'Error converting local video file';
    throw new Error(message);
  }

  return data;
};

export const mediaService = {
  getMyFiles,
  getSharedWithMe,
  uploadFile,
  shareFile,
  deleteFile,
  downloadFile,
  convertAudio,
  convertVideo,
  getLocalFiles,
  uploadLocalFile,
  deleteLocalFile,
  getLocalStream,
  downloadLocalFile,
  convertLocalAudio,
  convertLocalVideo,
};
