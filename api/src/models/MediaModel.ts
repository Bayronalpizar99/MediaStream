import { Timestamp } from 'firebase-admin/firestore';

export interface MediaConversionMetadata {
  sourceFileId: string;
  targetFormat: string;
  bitrateKbps: number;
  quality?: number;
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