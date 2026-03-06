import {
  AssetType,
  CharacterRequest,
  GeneratedFileInfo,
  GenerationJob,
  OutputMetadata,
  RegenerateAssetRequest,
} from '../types.js';
import { normalizeOutputFilename } from './output-normalizer.js';
import { generateImageWithOpenAi } from './openai-images.js';
import { saveBinary } from './storage.js';

const randomId = () => Math.random().toString(36).slice(2, 10);

const buildFileInfo = (type: AssetType): GeneratedFileInfo => {
  const id = randomId();
  const filename = `${type}-${id}.png`;
  return {
    id,
    type,
    filename,
    mimeType: 'image/png',
    bytes: 0,
    url: `/api/assets/files/${filename}`,
    createdAt: new Date().toISOString(),
  };
};

const buildAssetPrompt = (request: CharacterRequest, assetType: AssetType): string => {
  const stylePart = request.style ? ` Style: ${request.style}.` : '';
  return `${request.prompt}${stylePart} Create exactly one ${assetType} image.`;
};

const writeGeneratedAsset = async (
  fileInfo: GeneratedFileInfo,
  prompt: string,
): Promise<GeneratedFileInfo> => {
  const imageBuffer = await generateImageWithOpenAi({ prompt });
  const outputFilename = normalizeOutputFilename(fileInfo.filename);
  const finalName = `${outputFilename}.png`;
  await saveBinary(finalName, imageBuffer);

  return {
    ...fileInfo,
    filename: finalName,
    bytes: imageBuffer.byteLength,
    url: `/api/assets/files/${finalName}`,
  };
};

export const createGenerationJob = async (
  request: CharacterRequest,
): Promise<GenerationJob> => {
  const startedAt = Date.now();
  const files: GeneratedFileInfo[] = [];
  const errors: NonNullable<GenerationJob['errors']> = [];

  for (const assetType of request.assetTypes) {
    const fileInfo = buildFileInfo(assetType);

    try {
      files.push(await writeGeneratedAsset(fileInfo, buildAssetPrompt(request, assetType)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      files.push({ ...fileInfo, error: message });
      errors.push({ assetType, message });
    }
  }

  const successfulFiles = files.filter((file) => !file.error).length;

  const metadata: OutputMetadata = {
    prompt: request.prompt,
    style: request.style,
    seed: request.seed,
    model: 'gpt-image-1',
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  };

  return {
    id: randomId(),
    status:
      successfulFiles === files.length
        ? 'completed'
        : successfulFiles > 0
          ? 'partial'
          : 'failed',
    request,
    files,
    metadata,
    errors: errors.length ? errors : undefined,
  };
};

export const regenerateAsset = async (
  request: RegenerateAssetRequest,
): Promise<GeneratedFileInfo> => {
  const fileInfo = buildFileInfo(request.assetType);
  const prompt = request.promptOverride
    ? `${request.promptOverride} Create exactly one ${request.assetType} image.`
    : `Create exactly one ${request.assetType} image.`;

  return writeGeneratedAsset(fileInfo, prompt);
};
