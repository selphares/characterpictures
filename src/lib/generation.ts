import {
  AssetType,
  CharacterRequest,
  GeneratedFileInfo,
  GenerationJob,
  GenerationProfile,
  OutputMetadata,
  RegenerateAssetRequest,
} from '../types.js';
import { normalizeOutputFilename } from './output-normalizer.js';
import { generateImageWithOpenAi } from './openai-images.js';
import { saveBinary } from './storage.js';

const randomId = () => Math.random().toString(36).slice(2, 10);
const MAX_ASSET_COUNT = 8;
const DEFAULT_PROFILE: GenerationProfile = 'jrpg_assets';

type ImageSize = '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
type ImageBackground = 'transparent' | 'opaque' | 'auto';

interface AssetConfig {
  size: ImageSize;
  background: ImageBackground;
  instruction: string;
}

interface ProfileConfig {
  styleGuide: string;
  rules: string[];
  assets: Record<AssetType, AssetConfig>;
}

const PROFILE_CONFIG: Record<GenerationProfile, ProfileConfig> = {
  illustration: {
    styleGuide:
      'High-quality digital illustration with clean composition and clear subject readability.',
    rules: [
      'Generate exactly one image.',
      'No text, logos, watermark, or signature.',
      'Keep character identity consistent across all non-background assets in this job.',
      'Use one character only for character/avatar/portrait/token outputs.',
    ],
    assets: {
      character: {
        size: '1024x1536',
        background: 'transparent',
        instruction:
          'Full-body character art, standing pose, complete silhouette visible from head to toe, centered composition.',
      },
      avatar: {
        size: '1024x1024',
        background: 'transparent',
        instruction:
          'Head-and-shoulders avatar, face centered, clean framing, maintain same hairstyle and outfit colors as character art.',
      },
      portrait: {
        size: '1024x1536',
        background: 'transparent',
        instruction:
          'Detailed portrait from chest up with expressive face, maintain the same character design and outfit details.',
      },
      token: {
        size: '1024x1024',
        background: 'transparent',
        instruction:
          'Token-ready composition with a clear circular safe area around the character and transparent corners.',
      },
      background: {
        size: '1536x1024',
        background: 'opaque',
        instruction: 'Wide scenic environment background, no characters, no text.',
      },
    },
  },
  jrpg_assets: {
    styleGuide:
      '2D JRPG-style game asset look, clean anime line art, crisp cel shading, production-ready readability.',
    rules: [
      'Generate exactly one image.',
      'No text, logos, watermark, signature, or UI elements.',
      'Keep exactly the same character identity across character/avatar/portrait/token assets: same face, hair, outfit, accessories, and color palette.',
      'Use one character only for character/avatar/portrait/token outputs.',
      'Use practical game-ready clothing unless the user prompt explicitly requests otherwise.',
    ],
    assets: {
      character: {
        size: '1024x1536',
        background: 'transparent',
        instruction:
          'Single full-body character source asset, neutral standing pose, front-facing, complete silhouette visible with small empty margin around body.',
      },
      avatar: {
        size: '1024x1024',
        background: 'transparent',
        instruction:
          'Square avatar icon, head and shoulders, centered face, neutral expression, same outfit and colors as character asset.',
      },
      portrait: {
        size: '1024x1536',
        background: 'transparent',
        instruction:
          'Dialogue portrait (upper body to waist), readable facial expression, same design details as the character asset.',
      },
      token: {
        size: '1024x1024',
        background: 'transparent',
        instruction:
          'Round token-ready framing with subject centered in circular safe area, transparent outside area, same character design.',
      },
      background: {
        size: '1536x1024',
        background: 'opaque',
        instruction:
          'JRPG environment background only, no characters, no creatures, no text, clean playable scene composition.',
      },
    },
  },
};

const clampCount = (count: number | undefined): number => {
  if (!Number.isInteger(count)) {
    return 1;
  }

  return Math.max(1, Math.min(Number(count), MAX_ASSET_COUNT));
};

const normalizeProfile = (profile: GenerationProfile | undefined): GenerationProfile => {
  return profile ?? DEFAULT_PROFILE;
};

const normalizeFormatNotes = (formatNotes: string | undefined): string | undefined => {
  if (!formatNotes) {
    return undefined;
  }

  const trimmed = formatNotes.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeRequest = (request: CharacterRequest): CharacterRequest => {
  return {
    ...request,
    profile: normalizeProfile(request.profile),
    formatNotes: normalizeFormatNotes(request.formatNotes),
  };
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
  const profile = normalizeProfile(request.profile);
  const profileConfig = PROFILE_CONFIG[profile];
  const assetConfig = profileConfig.assets[assetType];

  const promptSections: string[] = [
    `Subject brief: ${request.prompt}.`,
    `Profile style: ${profileConfig.styleGuide}`,
    `Asset target: ${assetConfig.instruction}`,
    `Rules: ${profileConfig.rules.join(' ')}`,
  ];

  if (request.style) {
    promptSections.push(`Additional style preference: ${request.style}.`);
  }

  if (request.formatNotes) {
    promptSections.push(
      `Mandatory format requirements from user: ${request.formatNotes}. Follow these requirements strictly if they do not conflict with safety rules.`,
    );
  }

  if (totalVariants > 1) {
    promptSections.push(
      `Variant ${variant} of ${totalVariants}: keep core character identity unchanged and vary only camera angle, expression, or pose within the requested asset format.`,
    );
  }

  return promptSections.join('\n');
};

const parsePngDimensions = (buffer: Buffer): { width: number; height: number } | undefined => {
  if (buffer.byteLength < 24) {
    return undefined;
  }

  const pngSignature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== pngSignature) {
    return undefined;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

const writeGeneratedAsset = async (
  fileInfo: GeneratedFileInfo,
  prompt: string,
  size: ImageSize,
  background: ImageBackground,
): Promise<GeneratedFileInfo> => {
  const imageBuffer = await generateImageWithOpenAi({ prompt, size, background });
  const outputFilename = normalizeOutputFilename(fileInfo.filename.replace(/\.png$/i, ''));
  const finalName = `${outputFilename}.png`;
  await saveBinary(finalName, imageBuffer);

  const dimensions = parsePngDimensions(imageBuffer);

  return {
    ...fileInfo,
    filename: finalName,
    bytes: imageBuffer.byteLength,
    width: dimensions?.width,
    height: dimensions?.height,
    url: `/api/assets/files/${finalName}`,
  };
};

export const createGenerationJob = async (
  inputRequest: CharacterRequest,
): Promise<GenerationJob> => {
  const startedAt = Date.now();
  const request = normalizeRequest(inputRequest);
  const files: GeneratedFileInfo[] = [];
  const errors: NonNullable<GenerationJob['errors']> = [];
  const variantsPerType = clampCount(request.count);
  const profileConfig = PROFILE_CONFIG[normalizeProfile(request.profile)];

  for (const assetType of request.assetTypes) {
    const { size, background } = profileConfig.assets[assetType];

    for (let variant = 1; variant <= variantsPerType; variant += 1) {
      const fileInfo = buildFileInfo(assetType, variantsPerType > 1 ? variant : undefined);

      try {
        files.push(
          await writeGeneratedAsset(
            fileInfo,
            buildAssetPrompt(request, assetType, variant, variantsPerType),
            size,
            background,
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
    profile: request.profile,
    formatNotes: request.formatNotes,
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
  const profile = normalizeProfile(request.profile);
  const profileConfig = PROFILE_CONFIG[profile];
  const { size, background } = profileConfig.assets[request.assetType];

  const effectivePrompt = request.promptOverride?.trim()
    ? request.promptOverride.trim()
    : request.basePrompt?.trim()
      ? request.basePrompt.trim()
      : `Create one ${request.assetType} image.`;

  const characterRequest: CharacterRequest = {
    prompt: effectivePrompt,
    style: request.style,
    profile,
    formatNotes: normalizeFormatNotes(request.formatNotes),
    seed: request.seed,
    assetTypes: [request.assetType],
  };

  const prompt = buildAssetPrompt(characterRequest, request.assetType, 1, 1);

  return writeGeneratedAsset(fileInfo, prompt, size, background);
};
