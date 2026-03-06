export type AssetType =
  | 'character'
  | 'avatar'
  | 'portrait'
  | 'token'
  | 'background';

export type GenerationProfile = 'illustration' | 'jrpg_assets';

export interface CharacterRequest {
  prompt: string;
  style?: string;
  profile?: GenerationProfile;
  formatNotes?: string;
  seed?: number;
  assetTypes: AssetType[];
  count?: number;
}

export interface RegenerateAssetRequest {
  jobId: string;
  assetType: AssetType;
  fileId: string;
  basePrompt?: string;
  style?: string;
  profile?: GenerationProfile;
  formatNotes?: string;
  promptOverride?: string;
  seed?: number;
}

export interface GeneratedFileInfo {
  id: string;
  type: AssetType;
  variant?: number;
  filename: string;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
  url: string;
  createdAt: string;
  error?: string;
}

export interface OutputMetadata {
  prompt: string;
  style?: string;
  profile?: GenerationProfile;
  formatNotes?: string;
  seed?: number;
  count?: number;
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
