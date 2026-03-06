export const ALL_ASSET_TYPES = [
  'walk_down',
  'walk_left',
  'walk_right',
  'walk_up',
  'battler',
  'battler_attack',
  'faces',
  'portrait',
  'base_fullbody',
] as const;

export const IMAGE_PROVIDERS = ['openai', 'google'] as const;

export type AssetType = (typeof ALL_ASSET_TYPES)[number];
export type ImageProvider = (typeof IMAGE_PROVIDERS)[number];

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'partial';

export interface CharacterRequest {
  characterName: string;
  description: string;
  style?: string;
  notes?: string;
  outputDirName?: string;
  assetTypes?: AssetType[];
  provider?: ImageProvider;
  seed?: number;
}

export interface RegenerateAssetRequest {
  folderName: string;
  assetType: AssetType;
  promptOverride?: string;
  characterName?: string;
  description?: string;
  style?: string;
  notes?: string;
  provider?: ImageProvider;
  seed?: number;
}

export interface GeneratedFileInfo {
  assetType: AssetType;
  filename: string;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
  prompt: string;
  url: string;
  createdAt: string;
  status: 'generated' | 'failed';
  error?: string;
}

export interface OutputMetadata {
  characterName: string;
  description: string;
  style?: string;
  notes?: string;
  seed?: number;
  provider?: ImageProvider;
  model?: string;
  outputFolder: string;
  generatedAt: string;
  updatedAt: string;
  status: JobStatus;
  durationMs?: number;
  promptVariants: Partial<Record<AssetType, string>>;
  files: GeneratedFileInfo[];
}

export interface GenerationJob {
  id: string;
  status: JobStatus;
  folderName: string;
  request: CharacterRequest;
  files: GeneratedFileInfo[];
  metadata: OutputMetadata;
  errors?: Array<{
    assetType: AssetType;
    message: string;
  }>;
}

export interface OutputListItem {
  folderName: string;
  characterName: string;
  generatedAt: string;
  updatedAt: string;
  status: JobStatus;
  files: GeneratedFileInfo[];
}

export interface ImageProviderInfo {
  id: ImageProvider;
  label: string;
  configured: boolean;
  keyEnvVar: string;
  model: string;
  summary: string;
}
