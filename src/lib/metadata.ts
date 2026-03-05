export interface ImageMetadata {
  id: string;
  prompt: string;
  createdAt: string;
}

export function createMetadata(id: string, prompt: string): ImageMetadata {
  return {
    id,
    prompt,
    createdAt: new Date().toISOString()
  };
}
