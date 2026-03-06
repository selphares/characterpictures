import path from 'node:path';

import { Router } from 'express';

import { createGenerationJob, regenerateAsset } from '../lib/generation.js';
import { getOutputsDir } from '../lib/storage.js';
import {
  AssetType,
  CharacterRequest,
  GenerationProfile,
  RegenerateAssetRequest,
} from '../types.js';

const router = Router();
const MAX_COUNT = 8;
const VALID_ASSET_TYPES: AssetType[] = ['character', 'avatar', 'portrait', 'token', 'background'];
const VALID_ASSET_TYPE_SET = new Set<AssetType>(VALID_ASSET_TYPES);
const VALID_PROFILES: GenerationProfile[] = ['illustration', 'jrpg_assets'];
const VALID_PROFILE_SET = new Set<GenerationProfile>(VALID_PROFILES);

const createBadRequestError = (message: string, details?: unknown) => {
  const error = new Error(message) as Error & { statusCode?: number; details?: unknown };
  error.statusCode = 400;
  error.details = details;
  return error;
};

const parseOptionalCount = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_COUNT) {
    throw createBadRequestError('Invalid CharacterRequest payload.', {
      reason: `count must be an integer between 1 and ${MAX_COUNT}`,
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

const parseOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const parseOptionalProfile = (
  value: unknown,
  context: 'CharacterRequest' | 'RegenerateAssetRequest',
): GenerationProfile | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string' || !VALID_PROFILE_SET.has(value as GenerationProfile)) {
    throw createBadRequestError(`Invalid ${context} payload.`, {
      reason: 'profile contains unsupported value',
      allowed: VALID_PROFILES,
    });
  }

  return value as GenerationProfile;
};

const sanitizeCharacterRequest = (payload: unknown): CharacterRequest => {
  const body = (payload ?? {}) as Record<string, unknown>;
  const promptRaw = body.prompt;

  if (typeof promptRaw !== 'string' || !promptRaw.trim()) {
    throw createBadRequestError('Invalid CharacterRequest payload.', {
      required: ['prompt', 'assetTypes'],
      reason: 'prompt must be a non-empty string',
    });
  }

  const assetTypesRaw = body.assetTypes;
  if (!Array.isArray(assetTypesRaw) || assetTypesRaw.length === 0) {
    throw createBadRequestError('Invalid CharacterRequest payload.', {
      required: ['prompt', 'assetTypes'],
      reason: 'assetTypes must be a non-empty array',
      allowed: VALID_ASSET_TYPES,
    });
  }

  const parsedAssetTypes: AssetType[] = [];
  for (const rawType of assetTypesRaw) {
    if (typeof rawType !== 'string' || !VALID_ASSET_TYPE_SET.has(rawType as AssetType)) {
      throw createBadRequestError('Invalid CharacterRequest payload.', {
        required: ['prompt', 'assetTypes'],
        reason: 'assetTypes contains unsupported values',
        allowed: VALID_ASSET_TYPES,
      });
    }

    const assetType = rawType as AssetType;
    if (!parsedAssetTypes.includes(assetType)) {
      parsedAssetTypes.push(assetType);
    }
  }

  return {
    prompt: promptRaw.trim(),
    style: parseOptionalText(body.style),
    profile: parseOptionalProfile(body.profile, 'CharacterRequest'),
    formatNotes: parseOptionalText(body.formatNotes),
    seed: parseOptionalSeed(body.seed, 'CharacterRequest'),
    count: parseOptionalCount(body.count),
    assetTypes: parsedAssetTypes,
  };
};

const sanitizeRegenerateRequest = (payload: unknown): RegenerateAssetRequest => {
  const body = (payload ?? {}) as Record<string, unknown>;
  const jobIdRaw = body.jobId;
  const fileIdRaw = body.fileId;
  const assetTypeRaw = body.assetType;

  if (typeof jobIdRaw !== 'string' || !jobIdRaw.trim()) {
    throw createBadRequestError('Invalid RegenerateAssetRequest payload.', {
      required: ['jobId', 'fileId', 'assetType'],
      reason: 'jobId must be provided',
    });
  }

  if (typeof fileIdRaw !== 'string' || !fileIdRaw.trim()) {
    throw createBadRequestError('Invalid RegenerateAssetRequest payload.', {
      required: ['jobId', 'fileId', 'assetType'],
      reason: 'fileId must be provided',
    });
  }

  if (typeof assetTypeRaw !== 'string' || !VALID_ASSET_TYPE_SET.has(assetTypeRaw as AssetType)) {
    throw createBadRequestError('Invalid RegenerateAssetRequest payload.', {
      required: ['jobId', 'fileId', 'assetType'],
      reason: 'assetType must be one of the allowed values',
      allowed: VALID_ASSET_TYPES,
    });
  }

  return {
    jobId: jobIdRaw.trim(),
    fileId: fileIdRaw.trim(),
    assetType: assetTypeRaw as AssetType,
    basePrompt: parseOptionalText(body.basePrompt),
    style: parseOptionalText(body.style),
    profile: parseOptionalProfile(body.profile, 'RegenerateAssetRequest'),
    formatNotes: parseOptionalText(body.formatNotes),
    promptOverride: parseOptionalText(body.promptOverride),
    seed: parseOptionalSeed(body.seed, 'RegenerateAssetRequest'),
  };
};

router.post('/generate', async (req, res, next) => {
  try {
    const payload = sanitizeCharacterRequest(req.body);
    const job = await createGenerationJob(payload);
    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
});

router.post('/regenerate', async (req, res, next) => {
  try {
    const payload = sanitizeRegenerateRequest(req.body);
    const file = await regenerateAsset(payload);
    res.status(200).json(file);
  } catch (error) {
    next(error);
  }
});

router.get('/files/:filename', (req, res, next) => {
  try {
    const filename = path.basename(req.params.filename);
    const absoluteFile = path.join(getOutputsDir(), filename);
    res.sendFile(absoluteFile);
  } catch (error) {
    next(error);
  }
});

export default router;
