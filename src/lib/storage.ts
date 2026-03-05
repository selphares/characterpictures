import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const OUTPUTS_ROOT = "outputs";

export const ASSET_FILE_NAMES = {
  walk_down: "walk_down.png",
  walk_left: "walk_left.png",
  walk_right: "walk_right.png",
  walk_up: "walk_up.png",
  battler: "battler.png",
  faces: "faces.png",
  portrait: "portrait.png",
  base_fullbody: "base_fullbody.png",
} as const;

export type AssetName = keyof typeof ASSET_FILE_NAMES;

export type BinaryInput = Buffer | Uint8Array | string;

export interface SaveGeneratedAssetsParams {
  characterName: string;
  assets: Partial<Record<AssetName, BinaryInput>>;
  timestamp?: Date | string;
  outputsRoot?: string;
}

export interface OutputDirectoryInfo {
  outputDirectory: string;
  timestamp: string;
}

function sanitizeCharacterName(characterName: string): string {
  const sanitized = characterName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "character";
}

export function formatTimestamp(timestamp: Date | string = new Date()): string {
  if (typeof timestamp === "string") {
    return timestamp;
  }

  return timestamp.toISOString().replace(/[:.]/g, "-");
}

export async function createOutputDirectory(
  characterName: string,
  timestamp: Date | string = new Date(),
  outputsRoot = OUTPUTS_ROOT,
): Promise<OutputDirectoryInfo> {
  const formattedTimestamp = formatTimestamp(timestamp);
  const sanitizedName = sanitizeCharacterName(characterName);
  const folderName = `${sanitizedName}-${formattedTimestamp}`;
  const outputDirectory = path.join(outputsRoot, folderName);

  await mkdir(outputDirectory, { recursive: true });

  return {
    outputDirectory,
    timestamp: formattedTimestamp,
  };
}

function toBuffer(data: BinaryInput): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }

  const cleaned = data.startsWith("data:image/png;base64,")
    ? data.replace(/^data:image\/png;base64,/, "")
    : data;

  return Buffer.from(cleaned, "base64");
}

export async function saveGeneratedPngs({
  characterName,
  assets,
  timestamp,
  outputsRoot = OUTPUTS_ROOT,
}: SaveGeneratedAssetsParams): Promise<OutputDirectoryInfo & { files: string[] }> {
  const outputInfo = await createOutputDirectory(characterName, timestamp, outputsRoot);
  const files: string[] = [];

  for (const assetName of Object.keys(ASSET_FILE_NAMES) as AssetName[]) {
    const assetData = assets[assetName];
    if (!assetData) {
      continue;
    }

    const fileName = ASSET_FILE_NAMES[assetName];
    const filePath = path.join(outputInfo.outputDirectory, fileName);

    await writeFile(filePath, toBuffer(assetData));
    files.push(fileName);
  }

  return {
    ...outputInfo,
    files,
  };
}
