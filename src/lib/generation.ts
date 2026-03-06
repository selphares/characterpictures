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
const MAX_ASSET_COUNT = 8;

type ImageSize = '1024x1024' | '1024x1536' | '1536x1024' | 'auto';

const ASSET_CONFIG: Record<
  AssetType,
  {
    size: ImageSize;
    instruction: string;
  }
> = {
  character: {
    size: '1024x1536',
    instruction:
      'full body character concept art, standing pose, complete silhouette, no text or watermark',
  },
  avatar: {
    size: '1024x1024',
    instruction: 'head and shoulders avatar, centered composition, clean background, no text',
  },
  portrait: {
    size: '1024x1536',
    instruction: 'detailed portrait from chest up, expressive face, studio lighting, no text',
  },
  token: {
    size: '1024x1024',
    instruction:
      'round token-ready framing, high contrast subject, isolated readable character, no text',
  },
  background: {
    size: '1536x1024',
    instruction: 'wide scenic environment background, no characters, no text or logos',
  },
};

const clampCount = (count: number | undefined): number => {
  if (!Number.isInteger(count)) {
    return 1;
  }

  return Math.max(1, Math.min(Number(count), MAX_ASSET_COUNT));
};

const buildFileInfo = (type: AssetType, variant?: number): GeneratedFileInfo => {
  const id = randomId();
  const variantSuffix = variant ? `-v${String(variant).padStart(2, '0')}` : '';
  const basename = `${type}${variantSuffix}-${id}`;

  return {
    id,
    type,
    variant,
    filename: `${basename}.png`,
    mimeType: 'image/png',
    bytes: 0,
    url: `/api/assets/files/${basename}.png`,
    createdAt: new Date().toISOString(),
  };
};

const buildAssetPrompt = (
  request: CharacterRequest,
  assetType: AssetType,
  variant: number,
  totalVariants: number,
): string => {
  const { instruction } = ASSET_CONFIG[assetType];
  const stylePart = request.style ? ` Style: ${request.style}.` : '';
  const variationPart =
    totalVariants > 1
      ? ` This is variation ${variant} of ${totalVariants}. Keep the same character identity while changing composition, pose, or camera angle.`
      : '';

  return `${request.prompt}${stylePart} Generate exactly one image. Output format: ${instruction}.${variationPart}`;
};

const writeGeneratedAsset = async (
  fileInfo: GeneratedFileInfo,
  prompt: string,
  size: ImageSize,
): Promise<GeneratedFileInfo> => {
  const imageBuffer = await generateImageWithOpenAi({ prompt, size });
  const outputFilename = normalizeOutputFilename(fileInfo.filename.replace(/\.png$/i, ''));
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
  const variantsPerType = clampCount(request.count);

  for (const assetType of request.assetTypes) {
    const { size } = ASSET_CONFIG[assetType];

    for (let variant = 1; variant <= variantsPerType; variant += 1) {
      const fileInfo = buildFileInfo(assetType, variantsPerType > 1 ? variant : undefined);

      try {
        files.push(
          await writeGeneratedAsset(
            fileInfo,
            buildAssetPrompt(request, assetType, variant, variantsPerType),
            size,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        files.push({ ...fileInfo, error: message });
        errors.push({
          assetType,
          message:
            variantsPerType > 1 ? `variant ${variant}/${variantsPerType}: ${message}` : message,
        });
      }
    }
  }

  const successfulFiles = files.filter((file) => !file.error).length;

  const metadata: OutputMetadata = {
    prompt: request.prompt,
    style: request.style,
    seed: request.seed,
    count: variantsPerType,
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
    request: {
      ...request,
      count: variantsPerType,
    },
    files,
    metadata,
    errors: errors.length ? errors : undefined,
  };
};

export const regenerateAsset = async (
  request: RegenerateAssetRequest,
): Promise<GeneratedFileInfo> => {
  const fileInfo = buildFileInfo(request.assetType);
  const { instruction, size } = ASSET_CONFIG[request.assetType];
  const prompt = request.promptOverride
    ? `${request.promptOverride} Output format: ${instruction}.`
    : `Create one ${request.assetType} image. Output format: ${instruction}.`;

  return writeGeneratedAsset(fileInfo, prompt, size);
};
