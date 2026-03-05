export type AssetType =
  | 'character'
  | 'avatar'
  | 'portrait'
  | 'token'
  | 'background';

export interface CharacterRequest {
  prompt: string;
  style?: string;
  seed?: number;
  assetTypes: AssetType[];
  count?: number;
}

export interface RegenerateAssetRequest {
  jobId: string;
  assetType: AssetType;
  fileId: string;
  promptOverride?: string;
  seed?: number;
}

export interface GeneratedFileInfo {
  id: string;
  type: AssetType;
  filename: string;
  mimeType: string;
  bytes: number;
  url: string;
  createdAt: string;
  error?: string;
}

export interface OutputMetadata {
  prompt: string;
  style?: string;
  seed?: number;
  model?: string;
  generatedAt: string;
  durationMs?: number;
}

export interface GenerationJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'partial';
  request: CharacterRequest;
  files: GeneratedFileInfo[];
  metadata: OutputMetadata;
  errors?: Array<{
    assetType: AssetType;
    message: string;
  }>;
}
