import { Timestamp } from 'firebase-admin/firestore';

export type MediaConversionType = 'audio' | 'video';

export interface MediaConversionMetadata {
  type: MediaConversionType;
  sourceFileId: string;
  targetFormat: string;
  bitrateKbps?: number;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface MediaFile {
  id?: string;
  filename: string;       
  storagePath: string;    
  contentType: string;     
  size: number;            
  ownerId: string;         
  ownerUsername: string;   
  createdAt: Timestamp;
  
  // Clave para compartir:
  sharedWith: string[];
  conversion?: MediaConversionMetadata;
}
