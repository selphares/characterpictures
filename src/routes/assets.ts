import { Router } from 'express';

import { getImageProviderCatalog, resolveImageProvider } from '../lib/image-service.js';
import { createGenerationJob, regenerateAsset, uploadAssetImage } from '../lib/generation.js';
import { deleteOutputFolder, getOutputFilePath, listOutputs, readMetadata } from '../lib/storage.js';
import {
  ALL_ASSET_TYPES,
  AssetType,
  CharacterRequest,
  IMAGE_PROVIDERS,
  ImageProvider,
  RegenerateAssetRequest,
} from '../types.js';

const router = Router();
const VALID_ASSET_TYPE_SET = new Set<AssetType>(ALL_ASSET_TYPES);
const VALID_PROVIDER_SET = new Set<ImageProvider>(IMAGE_PROVIDERS);
const SUPPORTED_UPLOAD_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

type SupportedUploadMimeType = (typeof SUPPORTED_UPLOAD_MIME_TYPES)[number];

const createHttpError = (statusCode: number, message: string, details?: unknown) => {
  const error = new Error(message) as Error & { statusCode?: number; details?: unknown };
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

const createBadRequestError = (message: string, details?: unknown) => {
  return createHttpError(400, message, details);
};

const parseOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const parseRequiredText = (
  value: unknown,
  field: string,
  context: 'CharacterRequest' | 'RegenerateAssetRequest' | 'UploadAssetRequest',
): string => {
  const parsed = parseOptionalText(value);
  if (!parsed) {
    throw createBadRequestError(`Invalid ${context} payload.`, {
      required: [field],
    });
  }

  return parsed;
};

const parseOptionalSeed = (value: unknown, context: 'CharacterRequest' | 'RegenerateAssetRequest') => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw createBadRequestError(`Invalid ${context} payload.`, {
      reason: 'seed must be a finite number',
    });
  }

  return parsed;
};

const parseOptionalProvider = (value: unknown, context: 'CharacterRequest' | 'RegenerateAssetRequest') => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string' || !VALID_PROVIDER_SET.has(value as ImageProvider)) {
    throw createBadRequestError(`Invalid ${context} payload.`, {
      reason: 'provider contains unsupported value',
      allowed: IMAGE_PROVIDERS,
    });
  }

  return value as ImageProvider;
};

const parseOptionalAssetTypes = (value: unknown): AssetType[] | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw createBadRequestError('Invalid CharacterRequest payload.', {
      reason: 'assetTypes must be an array when provided',
      allowed: ALL_ASSET_TYPES,
    });
  }

  const assetTypes: AssetType[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !VALID_ASSET_TYPE_SET.has(entry as AssetType)) {
      throw createBadRequestError('Invalid CharacterRequest payload.', {
        reason: 'assetTypes contains unsupported values',
        allowed: ALL_ASSET_TYPES,
      });
    }

    if (!assetTypes.includes(entry as AssetType)) {
      assetTypes.push(entry as AssetType);
    }
  }

  return assetTypes;
};

const sanitizeCharacterRequest = (payload: unknown): CharacterRequest => {
  const body = (payload ?? {}) as Record<string, unknown>;
  const characterName = parseOptionalText(body.characterName);
  const description = parseOptionalText(body.description);

  if (!characterName || !description) {
    throw createBadRequestError('Invalid CharacterRequest payload.', {
      required: ['characterName', 'description'],
    });
  }

  return {
    characterName,
    description,
    style: parseOptionalText(body.style),
    notes: parseOptionalText(body.notes),
    outputDirName: parseOptionalText(body.outputDirName),
    assetTypes: parseOptionalAssetTypes(body.assetTypes),
    provider: parseOptionalProvider(body.provider, 'CharacterRequest'),
    seed: parseOptionalSeed(body.seed, 'CharacterRequest'),
  };
};

const sanitizeRegenerateRequest = (payload: unknown): RegenerateAssetRequest => {
  const body = (payload ?? {}) as Record<string, unknown>;
  const folderName = parseOptionalText(body.folderName);
  const assetType = parseOptionalText(body.assetType);

  if (!folderName || !assetType) {
    throw createBadRequestError('Invalid RegenerateAssetRequest payload.', {
      required: ['folderName', 'assetType'],
      allowed: ALL_ASSET_TYPES,
    });
  }

  if (!VALID_ASSET_TYPE_SET.has(assetType as AssetType)) {
    throw createBadRequestError('Invalid RegenerateAssetRequest payload.', {
      reason: 'assetType contains unsupported value',
      allowed: ALL_ASSET_TYPES,
    });
  }

  return {
    folderName,
    assetType: assetType as AssetType,
    promptOverride: parseOptionalText(body.promptOverride),
    characterName: parseOptionalText(body.characterName),
    description: parseOptionalText(body.description),
    style: parseOptionalText(body.style),
    notes: parseOptionalText(body.notes),
    provider: parseOptionalProvider(body.provider, 'RegenerateAssetRequest'),
    seed: parseOptionalSeed(body.seed, 'RegenerateAssetRequest'),
  };
};

const sanitizeUploadRequest = (payload: unknown) => {
  const body = (payload ?? {}) as Record<string, unknown>;
  const folderName = parseRequiredText(body.folderName, 'folderName', 'UploadAssetRequest');
  const assetType = parseRequiredText(body.assetType, 'assetType', 'UploadAssetRequest');
  const mimeType = parseRequiredText(body.mimeType, 'mimeType', 'UploadAssetRequest').toLowerCase();
  const imageBase64 = parseRequiredText(body.imageBase64, 'imageBase64', 'UploadAssetRequest');

  if (!VALID_ASSET_TYPE_SET.has(assetType as AssetType)) {
    throw createBadRequestError('Invalid UploadAssetRequest payload.', {
      reason: 'assetType contains unsupported value',
      allowed: ALL_ASSET_TYPES,
    });
  }

  if (!SUPPORTED_UPLOAD_MIME_TYPES.includes(mimeType as SupportedUploadMimeType)) {
    throw createBadRequestError('Invalid UploadAssetRequest payload.', {
      reason: 'mimeType contains unsupported value',
      allowed: SUPPORTED_UPLOAD_MIME_TYPES,
    });
  }

  return {
    folderName,
    assetType: assetType as AssetType,
    mimeType: mimeType as SupportedUploadMimeType,
    imageBuffer: Buffer.from(imageBase64, 'base64'),
  };
};

router.get('/providers', (_req, res) => {
  res.status(200).json({
    defaultProvider: resolveImageProvider(undefined),
    providers: getImageProviderCatalog(),
  });
});

router.post('/generate-set', async (req, res, next) => {
  try {
    const payload = sanitizeCharacterRequest(req.body);
    const job = await createGenerationJob(payload);
    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
});

router.post('/regenerate-asset', async (req, res, next) => {
  try {
    const payload = sanitizeRegenerateRequest(req.body);
    const job = await regenerateAsset(payload);
    res.status(200).json(job);
  } catch (error) {
    next(error);
  }
});

router.post('/upload-asset', async (req, res, next) => {
  try {
    const payload = sanitizeUploadRequest(req.body);
    const job = await uploadAssetImage(payload);
    res.status(200).json(job);
  } catch (error) {
    next(error);
  }
});

router.get('/list-outputs', async (_req, res, next) => {
  try {
    const outputs = await listOutputs();
    res.status(200).json(outputs);
  } catch (error) {
    next(error);
  }
});

router.delete('/output/:folder', async (req, res, next) => {
  try {
    await deleteOutputFolder(req.params.folder);
    res.status(200).json({ deleted: true, folderName: req.params.folder });
  } catch (error) {
    const maybeNodeError = error as NodeJS.ErrnoException;
    if (maybeNodeError?.code === 'ENOENT') {
      next(createHttpError(404, 'Output folder not found.', { folderName: req.params.folder }));
      return;
    }

    next(error);
  }
});

router.get('/output/:folder/metadata', async (req, res, next) => {
  try {
    const metadata = await readMetadata(req.params.folder);
    res.status(200).json(metadata);
  } catch (error) {
    next(error);
  }
});

router.get('/output/:folder/:file', (req, res, next) => {
  try {
    const absoluteFile = getOutputFilePath(req.params.folder, req.params.file);
    res.sendFile(absoluteFile);
  } catch (error) {
    next(error);
  }
});

export default router;
