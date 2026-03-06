const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';

export interface OpenAiImageInput {
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
}

export async function generateImageWithOpenAi(input: OpenAiImageInput): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Please configure it in your environment.');
  }

  const response = await fetch(OPENAI_IMAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: input.prompt,
      size: input.size ?? '1024x1024',
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI image generation failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };

  const base64Image = payload.data?.[0]?.b64_json;
  if (!base64Image) {
    throw new Error('OpenAI did not return image data.');
  }

  return Buffer.from(base64Image, 'base64');
}
