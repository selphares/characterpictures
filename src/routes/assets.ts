import { Router } from 'express';
import { createGenerationJob, regenerateAsset } from '../lib/generation';
import { CharacterRequest, RegenerateAssetRequest } from '../types';

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

export default router;
