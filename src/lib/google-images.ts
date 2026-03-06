const GOOGLE_GENERATE_CONTENT_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GOOGLE_MODEL = 'gemini-3.1-flash-image-preview';

export interface GoogleReferenceImage {
  filename: string;
  data: Buffer;
}

export interface GoogleImageInput {
  prompt: string;
  model?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  background?: 'transparent' | 'opaque' | 'auto';
  references?: GoogleReferenceImage[];
}

interface GoogleInlineData {
  mimeType?: string;
  mime_type?: string;
  data?: string;
}

interface GoogleContentPart {
  text?: string;
  inlineData?: GoogleInlineData;
  inline_data?: GoogleInlineData;
}

interface GoogleGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: GoogleContentPart[];
    };
    finishReason?: string;
    finish_reason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
    block_reason?: string;
  };
}

const resolveGoogleApiKey = (): string | undefined => {
  const directKey = process.env.GOOGLE_API_KEY?.trim();
  if (directKey) {
    return directKey;
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  return geminiKey || undefined;
};

const sizeInstruction = (size: GoogleImageInput['size']): string | undefined => {
  switch (size) {
    case '1024x1024':
      return 'Use a square 1:1 canvas.';
    case '1024x1536':
      return 'Use a portrait canvas with roughly 2:3 aspect ratio.';
    case '1536x1024':
      return 'Use a landscape canvas with roughly 3:2 aspect ratio.';
    default:
      return undefined;
  }
};

const backgroundInstruction = (background: GoogleImageInput['background']): string | undefined => {
  switch (background) {
    case 'transparent':
      return 'Use an empty clean background. If true alpha transparency is unavailable, use a flat neutral background that is easy to remove.';
    case 'opaque':
      return 'Use a clean opaque background with no extra scenery or props.';
    default:
      return undefined;
  }
};

const buildPrompt = (input: GoogleImageInput): string => {
  return [
    input.prompt,
    sizeInstruction(input.size),
    backgroundInstruction(input.background),
    input.references?.length
      ? 'The attached reference images are mandatory identity references. Keep the same character exactly.'
      : undefined,
  ]
    .filter(Boolean)
    .join('\n');
};

const buildRequestBody = (input: GoogleImageInput) => {
  const parts: Array<Record<string, unknown>> = [
    {
      text: buildPrompt(input),
    },
  ];

  for (const reference of input.references ?? []) {
    parts.push({
      inline_data: {
        mime_type: 'image/png',
        data: reference.data.toString('base64'),
      },
    });
  }

  return {
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };
};

const extractInlineData = (part: GoogleContentPart): GoogleInlineData | undefined => {
  return part.inlineData ?? part.inline_data;
};

const extractGoogleError = async (response: Response): Promise<string> => {
  const text = await response.text();
  return text || 'Unknown Google API error';
};

export async function generateImageWithGoogle(input: GoogleImageInput): Promise<Buffer> {
  const apiKey = resolveGoogleApiKey();

  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY is not set. Please configure one of them in your environment.');
  }

  const model = input.model ?? DEFAULT_GOOGLE_MODEL;
  const url = `${GOOGLE_GENERATE_CONTENT_URL}/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': apiKey,
    },
    body: JSON.stringify(buildRequestBody(input)),
  });

  if (!response.ok) {
    const details = await extractGoogleError(response);
    throw new Error(`Google image generation failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as GoogleGenerateContentResponse;
  const parts = payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
  const imagePart = parts.find((part) => {
    const inlineData = extractInlineData(part);
    return Boolean(inlineData?.data);
  });

  const inlineData = imagePart ? extractInlineData(imagePart) : undefined;
  if (!inlineData?.data) {
    const textSummary = parts
      .map((part) => part.text?.trim())
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .trim();
    const blockReason = payload.promptFeedback?.blockReason ?? payload.promptFeedback?.block_reason;
    const details = [blockReason, textSummary].filter(Boolean).join(' | ');
    throw new Error(`Google did not return image data${details ? `: ${details}` : '.'}`);
  }

  return Buffer.from(inlineData.data, 'base64');
}
