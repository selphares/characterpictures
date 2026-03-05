import { randomUUID } from "node:crypto";

import { createMetadata, type ImageMetadata } from "./metadata.js";
import { normalizeOutputFilename } from "./output-normalizer.js";
import { buildPrompt } from "./prompts.js";
import { saveJson } from "./storage.js";

export interface GenerateImageInput {
  characterName: string;
}

export interface GenerateImageResult {
  id: string;
  prompt: string;
  metadataPath: string;
  metadata: ImageMetadata;
}

export async function generateImageStub(input: GenerateImageInput): Promise<GenerateImageResult> {
  const id = randomUUID();
  const prompt = buildPrompt(input.characterName);
  const metadata = createMetadata(id, prompt);
  const filename = normalizeOutputFilename(`${input.characterName}-${id}`);
  const metadataPath = await saveJson(filename, metadata);

  return {
    id,
    prompt,
    metadataPath,
    metadata
  };
}
