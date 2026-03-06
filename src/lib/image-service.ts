import { IMAGE_PROVIDERS, ImageProvider, ImageProviderInfo } from '../types.js';
import { generateImageWithGoogle } from './google-images.js';
import { generateImageWithOpenAi } from './openai-images.js';

const DEFAULT_OPENAI_MODEL = 'gpt-image-1.5';
const DEFAULT_GOOGLE_MODEL = 'gemini-3.1-flash-image-preview';

export interface ImageReference {
  filename: string;
  data: Buffer;
}

export interface GenerateImageInput {
  provider?: ImageProvider;
  model?: string;
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  background?: 'transparent' | 'opaque' | 'auto';
  references?: ImageReference[];
}

export interface ImageGenerationContext {
  provider: ImageProvider;
  model: string;
}

const getOpenAiModel = (): string => {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
};

const getGoogleModel = (): string => {
  return process.env.GOOGLE_IMAGE_MODEL?.trim() || DEFAULT_GOOGLE_MODEL;
};

const hasOpenAiKey = (): boolean => {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
};

const hasGoogleKey = (): boolean => {
  return Boolean(process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim());
};

export const resolveImageProvider = (provider: ImageProvider | undefined): ImageProvider => {
  return provider === 'google' ? 'google' : 'openai';
};

export const getImageGenerationContext = (provider: ImageProvider | undefined): ImageGenerationContext => {
  const resolvedProvider = resolveImageProvider(provider);

  return {
    provider: resolvedProvider,
    model: resolvedProvider === 'google' ? getGoogleModel() : getOpenAiModel(),
  };
};

export const getImageProviderCatalog = (): ImageProviderInfo[] => {
  const providers: Record<ImageProvider, ImageProviderInfo> = {
    openai: {
      id: 'openai',
      label: 'OpenAI GPT Image 1',
      configured: hasOpenAiKey(),
      keyEnvVar: 'OPENAI_API_KEY',
      model: getOpenAiModel(),
      summary: 'Praezise Groessensteuerung, transparente Hintergruende und Referenz-Edits.',
    },
    google: {
      id: 'google',
      label: 'Google Gemini Image (Nano Banana 2)',
      configured: hasGoogleKey(),
      keyEnvVar: 'GOOGLE_API_KEY oder GEMINI_API_KEY',
      model: getGoogleModel(),
      summary: 'Google Gemini Bildgenerierung ueber generateContent mit Text-plus-Bild-Referenzen.',
    },
  };

  return IMAGE_PROVIDERS.map((provider) => providers[provider]);
};

export async function generateImage(input: GenerateImageInput): Promise<Buffer> {
  const context = {
    provider: resolveImageProvider(input.provider),
    model: input.model ?? getImageGenerationContext(input.provider).model,
  };

  if (context.provider === 'google') {
    return generateImageWithGoogle({
      prompt: input.prompt,
      model: context.model,
      size: input.size,
      background: input.background,
      references: input.references,
    });
  }

  return generateImageWithOpenAi({
    prompt: input.prompt,
    model: context.model,
    size: input.size,
    background: input.background,
    references: input.references,
  });
}


