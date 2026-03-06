import path from 'node:path';

import { Router } from 'express';

import { createGenerationJob, regenerateAsset } from '../lib/generation.js';
import { getOutputsDir } from '../lib/storage.js';
import { CharacterRequest, RegenerateAssetRequest } from '../types.js';

const router = Router();

router.post('/generate', async (req, res, next) => {
  try {
    const payload = req.body as CharacterRequest;

    if (!payload?.prompt || !Array.isArray(payload.assetTypes) || payload.assetTypes.length === 0) {
      const error = new Error('Invalid CharacterRequest payload.') as Error & {
        statusCode?: number;
        details?: unknown;
      };
      error.statusCode = 400;
      error.details = {
        required: ['prompt', 'assetTypes'],
      };
      throw error;
    }

    const job = await createGenerationJob(payload);
    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
});

router.post('/regenerate', async (req, res, next) => {
  try {
    const payload = req.body as RegenerateAssetRequest;

    if (!payload?.jobId || !payload?.fileId || !payload?.assetType) {
      const error = new Error('Invalid RegenerateAssetRequest payload.') as Error & {
        statusCode?: number;
        details?: unknown;
      };
      error.statusCode = 400;
      error.details = {
        required: ['jobId', 'fileId', 'assetType'],
      };
      throw error;
    }

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
