import { writeFile } from "node:fs/promises";
import path from "node:path";

import { type AssetName, formatTimestamp } from "./storage";

export interface JobStatusInfo {
  jobId?: string;
  status?: string;
  previousJobId?: string;
  regeneratedFromTimestamp?: string;
  [key: string]: unknown;
}

export interface MetadataInput {
  characterName: string;
  description: string;
  style: string;
  additionalNotes?: string;
  timestamp?: Date | string;
  files: string[];
  promptVariants: Partial<Record<AssetName, string | string[]>>;
  job?: JobStatusInfo;
}

export interface CharacterMetadata {
  characterName: string;
  description: string;
  style: string;
  additionalNotes?: string;
  timestamp: string;
  files: string[];
  promptVariants: Partial<Record<AssetName, string | string[]>>;
  job?: JobStatusInfo;
}

export function buildMetadata(input: MetadataInput): CharacterMetadata {
  return {
    characterName: input.characterName,
    description: input.description,
    style: input.style,
    additionalNotes: input.additionalNotes,
    timestamp: formatTimestamp(input.timestamp ?? new Date()),
    files: input.files,
    promptVariants: input.promptVariants,
    job: input.job,
  };
}

export async function writeMetadataFile(
  outputDirectory: string,
  metadata: MetadataInput,
): Promise<{ path: string; data: CharacterMetadata }> {
  const data = buildMetadata(metadata);
  const metadataPath = path.join(outputDirectory, "metadata.json");

  await writeFile(metadataPath, JSON.stringify(data, null, 2), "utf-8");

  return {
    path: metadataPath,
    data,
  };
}
