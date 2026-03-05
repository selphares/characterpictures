export type GenerateImageInput = {
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  model?: string;
};

export type GeneratedImage = {
  b64Json: string;
  revisedPrompt?: string;
};

const OPENAI_API_URL = "https://api.openai.com/v1/images/generations";
const DEFAULT_MODEL = "gpt-image-1";
const DEFAULT_SIZE: NonNullable<GenerateImageInput["size"]> = "1024x1024";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 500,
    public readonly exposeMessage = true,
  ) {
    super(message);
    this.name = "AppError";
  }
}

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{10,}/g,
  /bearer\s+[a-zA-Z0-9._-]+/gi,
  /api[_-]?key\s*[:=]\s*[^\s,;]+/gi,
  /authorization\s*[:=]\s*[^\s,;]+/gi,
];

export function sanitizeErrorMessage(input: string): string {
  return SENSITIVE_PATTERNS.reduce(
    (sanitized, pattern) => sanitized.replace(pattern, "[REDACTED]"),
    input,
  );
}

function toSafeError(error: unknown, fallback = "Unexpected server error"): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    const safeMessage = sanitizeErrorMessage(error.message || fallback);
    return new AppError("INTERNAL_ERROR", safeMessage, 500, false);
  }

  return new AppError("INTERNAL_ERROR", fallback, 500, false);
}

function getOpenAiApiKey(): string {
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    throw new AppError(
      "MISSING_OPENAI_API_KEY",
      "OPENAI_API_KEY is not configured on the server",
      500,
      false,
    );
  }

  return key;
}

export async function generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
  const prompt = input.prompt?.trim();

  if (!prompt) {
    throw new AppError("INVALID_PROMPT", "Prompt must not be empty", 400);
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getOpenAiApiKey()}`,
      },
      body: JSON.stringify({
        model: input.model ?? DEFAULT_MODEL,
        prompt,
        size: input.size ?? DEFAULT_SIZE,
      }),
    });

    if (!response.ok) {
      const rawError = await response.text();
      const safeMessage = sanitizeErrorMessage(rawError || response.statusText);
      throw new AppError(
        "OPENAI_IMAGE_GENERATION_FAILED",
        `Image generation failed (${response.status}): ${safeMessage}`,
        response.status,
        false,
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string; revised_prompt?: string }>;
    };

    const item = payload.data?.[0];

    if (!item?.b64_json) {
      throw new AppError(
        "OPENAI_INVALID_RESPONSE",
        "OpenAI response did not include image data",
        502,
        false,
      );
    }

    return {
      b64Json: item.b64_json,
      revisedPrompt: item.revised_prompt,
    };
  } catch (error) {
    throw toSafeError(error);
  }
}

export function formatErrorForClient(error: unknown): { code: string; message: string } {
  const safeError = toSafeError(error);

  return {
    code: safeError.code,
    message: safeError.exposeMessage
      ? safeError.message
      : "An internal server error occurred.",
  };
}
