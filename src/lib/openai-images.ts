const OPENAI_IMAGES_GENERATIONS_URL = 'https://api.openai.com/v1/images/generations';
const OPENAI_IMAGES_EDITS_URL = 'https://api.openai.com/v1/images/edits';
const DEFAULT_OPENAI_MODEL = 'gpt-image-1.5';

export interface OpenAiReferenceImage {
  filename: string;
  data: Buffer;
}

export interface OpenAiImageInput {
  prompt: string;
  model?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  background?: 'transparent' | 'opaque' | 'auto';
  references?: OpenAiReferenceImage[];
}

const postImageGeneration = async (
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<Response> => {
  return fetch(OPENAI_IMAGES_GENERATIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
};

const toPngBlob = (buffer: Buffer): Blob => {
  const bytes = new Uint8Array(buffer);
  return new Blob([bytes], { type: 'image/png' });
};

const postImageEdit = async (
  apiKey: string,
  input: OpenAiImageInput,
  includeOptionalParams: boolean,
): Promise<Response> => {
  const formData = new FormData();
  formData.append('model', input.model ?? DEFAULT_OPENAI_MODEL);
  formData.append('prompt', input.prompt);
  formData.append('size', input.size ?? '1024x1024');

  if (includeOptionalParams) {
    formData.append('background', input.background ?? 'auto');
    formData.append('output_format', 'png');
    formData.append('input_fidelity', 'high');
  }

  for (const reference of input.references ?? []) {
    formData.append('image[]', toPngBlob(reference.data), reference.filename);
  }

  return fetch(OPENAI_IMAGES_EDITS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });
};

const extractImageBuffer = async (response: Response): Promise<Buffer> => {
  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };

  const base64Image = payload.data?.[0]?.b64_json;
  if (!base64Image) {
    throw new Error('OpenAI did not return image data.');
  }

  return Buffer.from(base64Image, 'base64');
};

const generateWithoutReferences = async (
  apiKey: string,
  input: OpenAiImageInput,
): Promise<Buffer> => {
  const basePayload: Record<string, unknown> = {
    model: input.model ?? DEFAULT_OPENAI_MODEL,
    prompt: input.prompt,
    size: input.size ?? '1024x1024',
  };

  const enhancedPayload: Record<string, unknown> = {
    ...basePayload,
    background: input.background ?? 'auto',
    output_format: 'png',
  };

  let response = await postImageGeneration(apiKey, enhancedPayload);

  if (!response.ok) {
    const details = await response.text();
    const shouldFallback =
      response.status === 400 && /(background|output_format|unknown parameter|unsupported)/i.test(details);

    if (!shouldFallback) {
      throw new Error(`OpenAI image generation failed (${response.status}): ${details}`);
    }

    response = await postImageGeneration(apiKey, basePayload);
    if (!response.ok) {
      const fallbackDetails = await response.text();
      throw new Error(
        `OpenAI image generation failed (${response.status}) after fallback: ${fallbackDetails}`,
      );
    }
  }

  return extractImageBuffer(response);
};

const shouldRetryEditWithoutOptionalParams = (status: number, details: string): boolean => {
  return status === 400 && /(background|output_format|input_fidelity|unknown parameter|unsupported)/i.test(details);
};

const shouldFallbackToGeneration = (status: number, details: string): boolean => {
  return status === 404 || status === 415 || /(unsupported|unknown parameter|not found)/i.test(details);
};

export async function generateImageWithOpenAi(input: OpenAiImageInput): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Please configure it in your environment.');
  }

  const hasReferences = Boolean(input.references?.length);

  if (!hasReferences) {
    return generateWithoutReferences(apiKey, input);
  }

  let response = await postImageEdit(apiKey, input, true);
  let details = '';

  if (!response.ok) {
    details = await response.text();

    if (shouldRetryEditWithoutOptionalParams(response.status, details)) {
      response = await postImageEdit(apiKey, input, false);

      if (!response.ok) {
        details = await response.text();
      }
    }
  }

  if (!response.ok) {
    if (shouldFallbackToGeneration(response.status, details)) {
      return generateWithoutReferences(apiKey, input);
    }

    throw new Error(`OpenAI image edit failed (${response.status}): ${details}`);
  }

  return extractImageBuffer(response);
}

