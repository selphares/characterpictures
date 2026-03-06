import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { OutputListItem, OutputMetadata } from '../types.js';
import { normalizeOutputFilename } from './output-normalizer.js';

const OUTPUTS_DIR = process.env.OUTPUTS_DIR ?? 'outputs';
const METADATA_FILENAME = 'metadata.json';

const resolveOutputsDir = (): string => {
  return path.resolve(process.cwd(), OUTPUTS_DIR);
};

const assertSafePathSegment = (value: string, label: string): string => {
  const trimmed = value.trim();
  const safeValue = path.basename(trimmed);

  if (!trimmed || safeValue !== trimmed) {
    throw new Error(`Invalid ${label}.`);
  }

  return safeValue;
};

const formatTimestampForFolder = (value: Date): string => {
  return value.toISOString().replace(/[:.]/g, '-');
};

export async function ensureOutputsDir(): Promise<string> {
  const absoluteDir = resolveOutputsDir();
  await mkdir(absoluteDir, { recursive: true });
  return absoluteDir;
}

export function getOutputsDir(): string {
  return resolveOutputsDir();
}

export async function createOutputFolder(
  characterName: string,
  outputDirName?: string,
): Promise<{ folderName: string; absolutePath: string }> {
  const outputsDir = await ensureOutputsDir();
  const baseName = normalizeOutputFilename(outputDirName?.trim() || characterName.trim() || 'character');
  const folderName = `${baseName}-${formatTimestampForFolder(new Date())}`;
  const absolutePath = path.join(outputsDir, folderName);
  await mkdir(absolutePath, { recursive: true });

  return {
    folderName,
    absolutePath,
  };
}

export async function ensureOutputFolder(folderName: string): Promise<string> {
  const safeFolderName = assertSafePathSegment(folderName, 'folderName');
  const outputsDir = await ensureOutputsDir();
  const absolutePath = path.join(outputsDir, safeFolderName);
  await mkdir(absolutePath, { recursive: true });
  return absolutePath;
}

export async function deleteOutputFolder(folderName: string): Promise<void> {
  const safeFolderName = assertSafePathSegment(folderName, 'folderName');
  const target = path.join(resolveOutputsDir(), safeFolderName);
  await rm(target, { recursive: true, force: false });
}

export async function saveBinary(folderName: string, filename: string, data: Buffer): Promise<string> {
  const outputDir = await ensureOutputFolder(folderName);
  const safeFilename = assertSafePathSegment(filename, 'filename');
  const target = path.join(outputDir, safeFilename);
  await writeFile(target, data);
  return target;
}

export async function readBinary(folderName: string, filename: string): Promise<Buffer> {
  const target = getOutputFilePath(folderName, filename);
  return readFile(target);
}

export async function saveMetadata(folderName: string, data: OutputMetadata): Promise<string> {
  const outputDir = await ensureOutputFolder(folderName);
  const target = path.join(outputDir, METADATA_FILENAME);
  await writeFile(target, JSON.stringify(data, null, 2), 'utf-8');
  return target;
}

export async function readMetadata(folderName: string): Promise<OutputMetadata> {
  const safeFolderName = assertSafePathSegment(folderName, 'folderName');
  const metadataPath = path.join(resolveOutputsDir(), safeFolderName, METADATA_FILENAME);
  const raw = await readFile(metadataPath, 'utf-8');
  return JSON.parse(raw) as OutputMetadata;
}

export async function listOutputs(): Promise<OutputListItem[]> {
  const outputsDir = await ensureOutputsDir();
  const entries = await readdir(outputsDir, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));

  const items = await Promise.all(
    folders.map(async (folderName) => {
      try {
        const metadata = await readMetadata(folderName);
        return {
          folderName: metadata.outputFolder,
          characterName: metadata.characterName,
          generatedAt: metadata.generatedAt,
          updatedAt: metadata.updatedAt,
          status: metadata.status,
          files: metadata.files,
        } satisfies OutputListItem;
      } catch {
        return undefined;
      }
    }),
  );

  return items.filter((item): item is OutputListItem => Boolean(item));
}

export function getOutputFilePath(folderName: string, filename: string): string {
  const safeFolderName = assertSafePathSegment(folderName, 'folderName');
  const safeFilename = assertSafePathSegment(filename, 'filename');
  return path.join(resolveOutputsDir(), safeFolderName, safeFilename);
}
