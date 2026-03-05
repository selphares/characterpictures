import {
  AssetType,
  CharacterRequest,
  GeneratedFileInfo,
  GenerationJob,
  OutputMetadata,
  RegenerateAssetRequest,
} from '../types';

const randomId = () => Math.random().toString(36).slice(2, 10);

const buildFileInfo = (type: AssetType): GeneratedFileInfo => {
  const id = randomId();
  return {
    id,
    type,
    filename: `${type}-${id}.png`,
    mimeType: 'image/png',
    bytes: 0,
    url: `/assets/${type}/${id}.png`,
    createdAt: new Date().toISOString(),
  };
};

export const createGenerationJob = async (
  request: CharacterRequest,
): Promise<GenerationJob> => {
  const startedAt = Date.now();

  const files = request.assetTypes.map((assetType) => buildFileInfo(assetType));

  const metadata: OutputMetadata = {
    prompt: request.prompt,
    style: request.style,
    seed: request.seed,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  };

  return {
    id: randomId(),
    status: 'completed',
    request,
    files,
    metadata,
  };
};

export const regenerateAsset = async (
  request: RegenerateAssetRequest,
): Promise<GeneratedFileInfo> => {
  return buildFileInfo(request.assetType);
};
