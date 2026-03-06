import { ALL_ASSET_TYPES, AssetType, CharacterRequest, GeneratedFileInfo, JobStatus, OutputMetadata } from '../types.js';

interface CreateMetadataInput {
  folderName: string;
  request: CharacterRequest;
  files: GeneratedFileInfo[];
  promptVariants: Partial<Record<AssetType, string>>;
  status: JobStatus;
  durationMs?: number;
  model?: string;
  generatedAt?: string;
  updatedAt?: string;
}

const sortFiles = (files: GeneratedFileInfo[]): GeneratedFileInfo[] => {
  const order = new Map(ALL_ASSET_TYPES.map((assetType, index) => [assetType, index]));

  return [...files].sort((left, right) => {
    return (order.get(left.assetType) ?? 999) - (order.get(right.assetType) ?? 999);
  });
};

export const createOutputMetadata = ({
  folderName,
  request,
  files,
  promptVariants,
  status,
  durationMs,
  model,
  generatedAt,
  updatedAt,
}: CreateMetadataInput): OutputMetadata => {
  const createdAt = generatedAt ?? new Date().toISOString();

  return {
    characterName: request.characterName,
    description: request.description,
    style: request.style,
    notes: request.notes,
    seed: request.seed,
    provider: request.provider,
    model,
    outputFolder: folderName,
    generatedAt: createdAt,
    updatedAt: updatedAt ?? createdAt,
    status,
    durationMs,
    promptVariants,
    files: sortFiles(files),
  };
};

export const replaceFileInMetadata = (
  metadata: OutputMetadata,
  file: GeneratedFileInfo,
  prompt: string,
  status: JobStatus,
): OutputMetadata => {
  const remainingFiles = metadata.files.filter((entry) => entry.assetType !== file.assetType);
  const updatedAt = new Date().toISOString();

  return {
    ...metadata,
    updatedAt,
    status,
    promptVariants: {
      ...metadata.promptVariants,
      [file.assetType]: prompt,
    },
    files: sortFiles([...remainingFiles, file]),
  };
};
