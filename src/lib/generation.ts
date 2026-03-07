import {
  ALL_ASSET_TYPES,
  AssetType,
  CharacterRequest,
  GeneratedFileInfo,
  GeneratedFileSource,
  GenerationJob,
  JobStatus,
  OutputMetadata,
  RegenerateAssetRequest,
} from '../types.js';
import { createOutputMetadata, replaceFileInMetadata } from './metadata.js';
import {
  generateImage,
  getImageGenerationContext,
  ImageReference,
  isManualPromptProvider,
  resolveImageProvider,
} from './image-service.js';
import {
  buildManualPromptEnvelope,
  getAssetConfig,
  getConsistencyAnchorFilename,
  planAssets,
  planConsistencyAnchor,
} from './prompts.js';
import {
  createOutputFolder,
  readBinary,
  readMetadata,
  saveBinary,
  saveMetadata,
} from './storage.js';

const randomId = () => Math.random().toString(36).slice(2, 10);
const MAX_REFERENCE_IMAGES = 3;
const ANCHOR_REFERENCE_ID = 'consistency_anchor' as const;
const SUPPORTED_UPLOAD_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const UPLOAD_MIME_TO_EXTENSION: Record<(typeof SUPPORTED_UPLOAD_MIME_TYPES)[number], string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

type UploadMimeType = (typeof SUPPORTED_UPLOAD_MIME_TYPES)[number];
type ReferenceId = AssetType | typeof ANCHOR_REFERENCE_ID;

const GENERATION_PRIORITY: AssetType[] = [
  'base_fullbody',
  'portrait',
  'faces',
  'walk_down',
  'walk_left',
  'walk_right',
  'walk_up',
  'battler',
  'battler_attack',
];

const GENERATION_PRIORITY_INDEX = new Map(
  GENERATION_PRIORITY.map((assetType, index) => [assetType, index]),
);

interface BufferedReferenceImage extends ImageReference {
  referenceId: ReferenceId;
}

const normalizeOptionalText = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeAssetTypes = (assetTypes: AssetType[] | undefined): AssetType[] => {
  if (!assetTypes || assetTypes.length === 0) {
    return [...ALL_ASSET_TYPES];
  }

  return [...new Set(assetTypes)];
};

const normalizeCharacterRequest = (request: CharacterRequest): CharacterRequest => {
  return {
    characterName: request.characterName.trim(),
    description: request.description.trim(),
    style: normalizeOptionalText(request.style),
    notes: normalizeOptionalText(request.notes),
    outputDirName: normalizeOptionalText(request.outputDirName),
    seed: request.seed,
    provider: resolveImageProvider(request.provider),
    assetTypes: normalizeAssetTypes(request.assetTypes),
  };
};

const sortAssetTypesForGeneration = (assetTypes: AssetType[]): AssetType[] => {
  return [...assetTypes].sort((left, right) => {
    return (GENERATION_PRIORITY_INDEX.get(left) ?? 999) - (GENERATION_PRIORITY_INDEX.get(right) ?? 999);
  });
};

const parsePngDimensions = (buffer: Buffer): { width: number; height: number } | undefined => {
  if (buffer.byteLength < 24) {
    return undefined;
  }

  const pngSignature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== pngSignature) {
    return undefined;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

const buildStatusFromFiles = (files: GeneratedFileInfo[]): JobStatus => {
  const generatedCount = files.filter((file) => file.status === 'generated').length;
  const failedCount = files.filter((file) => file.status === 'failed').length;
  const pendingCount = files.filter((file) => file.status === 'pending').length;

  if (generatedCount === files.length) {
    return 'completed';
  }

  if (generatedCount > 0) {
    return 'partial';
  }

  if (pendingCount === files.length) {
    return 'draft';
  }

  if (failedCount === files.length) {
    return 'failed';
  }

  if (pendingCount > 0) {
    return 'draft';
  }

  return 'failed';
};

const buildGeneratedFileInfo = (
  folderName: string,
  assetType: AssetType,
  filename: string,
  prompt: string,
  imageBuffer: Buffer,
  mimeType = 'image/png',
  source: GeneratedFileSource = 'api',
): GeneratedFileInfo => {
  const dimensions = mimeType === 'image/png' ? parsePngDimensions(imageBuffer) : undefined;

  return {
    assetType,
    filename,
    mimeType,
    bytes: imageBuffer.byteLength,
    width: dimensions?.width,
    height: dimensions?.height,
    prompt,
    url: `/api/output/${folderName}/${filename}`,
    createdAt: new Date().toISOString(),
    status: 'generated',
    source,
  };
};

const buildPendingFileInfo = (
  folderName: string,
  assetType: AssetType,
  filename: string,
  prompt: string,
): GeneratedFileInfo => {
  return {
    assetType,
    filename,
    mimeType: 'image/png',
    bytes: 0,
    prompt,
    url: `/api/output/${folderName}/${filename}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
    source: 'prompt_plan',
  };
};

const buildFailedFileInfo = (
  folderName: string,
  assetType: AssetType,
  filename: string,
  prompt: string,
  error: string,
): GeneratedFileInfo => {
  return {
    assetType,
    filename,
    mimeType: 'image/png',
    bytes: 0,
    prompt,
    url: `/api/output/${folderName}/${filename}`,
    createdAt: new Date().toISOString(),
    status: 'failed',
    source: 'api',
    error,
  };
};

const loadRequestFromMetadata = (
  metadata: OutputMetadata,
  request: RegenerateAssetRequest,
): CharacterRequest => {
  return {
    characterName: normalizeOptionalText(request.characterName) ?? metadata.characterName,
    description: normalizeOptionalText(request.description) ?? metadata.description,
    style: normalizeOptionalText(request.style) ?? metadata.style,
    notes: normalizeOptionalText(request.notes) ?? metadata.notes,
    seed: request.seed ?? metadata.seed,
    provider: resolveImageProvider(request.provider ?? metadata.provider),
    assetTypes: [request.assetType],
  };
};

const buildReferenceLockedPrompt = (prompt: string, referenceIds: ReferenceId[]): string => {
  const consistencyRules = [
    'Consistency lock: this must be the exact same character as the canonical set.',
    'Preserve the exact same face shape, eye shape, hairstyle, hair color, skin tone, ear shape, tail shape, body proportions, outfit silhouette, accessory placement, and overall palette.',
    'Do not redesign, reinterpret, age up, stylize differently, swap costume details, or alter proportions.',
    'If any detail is ambiguous, copy the reference images exactly instead of inventing a variation.',
  ];

  if (referenceIds.includes(ANCHOR_REFERENCE_ID)) {
    consistencyRules.push(
      'The provided consistency anchor turnaround sheet is the single source of truth for the character model. Match it exactly.',
    );
  }

  if (referenceIds.includes('portrait')) {
    consistencyRules.push(
      'Use the portrait reference only to preserve face detail and expression framing while still obeying the consistency anchor.',
    );
  }

  if (referenceIds.includes('battler')) {
    consistencyRules.push(
      'Use the battler reference only for combat stance timing and pose language while still obeying the consistency anchor.',
    );
  }

  return [
    prompt,
    referenceIds.length > 0 ? `Reference assets provided: ${referenceIds.join(', ')}.` : undefined,
    ...consistencyRules,
  ]
    .filter(Boolean)
    .join('\n');
};

const buildWorkflowPrompt = (
  provider: CharacterRequest['provider'],
  prompt: string,
  references: BufferedReferenceImage[],
): string => {
  if (isManualPromptProvider(provider)) {
    return buildManualPromptEnvelope(prompt, references.map((reference) => reference.filename));
  }

  return buildReferenceLockedPrompt(
    prompt,
    references.map((reference) => reference.referenceId),
  );
};

const createBufferedReference = (
  referenceId: ReferenceId,
  filename: string,
  data: Buffer,
  mimeType = 'image/png',
): BufferedReferenceImage => {
  return {
    referenceId,
    filename,
    data,
    mimeType,
  };
};

const buildGenerationReferences = (
  assetType: AssetType,
  anchorReference: BufferedReferenceImage | undefined,
  generatedAssets: Map<AssetType, BufferedReferenceImage>,
): BufferedReferenceImage[] => {
  const references: BufferedReferenceImage[] = [];

  if (assetType === 'faces') {
    const portraitReference = generatedAssets.get('portrait');
    if (portraitReference) {
      references.push(portraitReference);
    }
  }

  if (assetType === 'battler_attack') {
    const battlerReference = generatedAssets.get('battler');
    if (battlerReference) {
      references.push(battlerReference);
    }
  }

  if (anchorReference) {
    references.push(anchorReference);
  }

  return references.slice(0, MAX_REFERENCE_IMAGES);
};

const tryLoadAnchorReference = async (folderName: string): Promise<BufferedReferenceImage | undefined> => {
  try {
    const filename = getConsistencyAnchorFilename();
    const data = await readBinary(folderName, filename);
    return createBufferedReference(ANCHOR_REFERENCE_ID, filename, data);
  } catch {
    return undefined;
  }
};

const tryLoadGeneratedAssetReference = async (
  metadata: OutputMetadata,
  assetType: AssetType,
): Promise<BufferedReferenceImage | undefined> => {
  const file = metadata.files.find(
    (entry) => entry.assetType === assetType && entry.status === 'generated',
  );

  if (!file) {
    return undefined;
  }

  try {
    const data = await readBinary(metadata.outputFolder, file.filename);
    return createBufferedReference(assetType, file.filename, data, file.mimeType);
  } catch {
    return undefined;
  }
};

const buildRegenerationReferences = async (
  metadata: OutputMetadata,
  assetType: AssetType,
): Promise<BufferedReferenceImage[]> => {
  const references: BufferedReferenceImage[] = [];

  if (assetType === 'faces') {
    const portraitReference = await tryLoadGeneratedAssetReference(metadata, 'portrait');
    if (portraitReference) {
      references.push(portraitReference);
    }
  }

  if (assetType === 'battler_attack') {
    const battlerReference = await tryLoadGeneratedAssetReference(metadata, 'battler');
    if (battlerReference) {
      references.push(battlerReference);
    }
  }

  const anchorReference = await tryLoadAnchorReference(metadata.outputFolder);
  if (anchorReference) {
    references.push(anchorReference);
  }

  if (references.length === 0) {
    const fallbackBase = await tryLoadGeneratedAssetReference(metadata, 'base_fullbody');
    if (fallbackBase) {
      references.push(fallbackBase);
    }

    const fallbackPortrait = await tryLoadGeneratedAssetReference(metadata, 'portrait');
    if (fallbackPortrait && !references.some((reference) => reference.referenceId === 'portrait')) {
      references.push(fallbackPortrait);
    }
  }

  return references.slice(0, MAX_REFERENCE_IMAGES);
};

const generateAnchorReference = async (
  folderName: string,
  request: CharacterRequest,
  model: string,
): Promise<BufferedReferenceImage | undefined> => {
  const plannedAnchor = planConsistencyAnchor(request);

  try {
    const imageBuffer = await generateImage({
      provider: request.provider,
      model,
      prompt: plannedAnchor.prompt,
      size: plannedAnchor.size,
      background: plannedAnchor.background,
    });

    await saveBinary(folderName, plannedAnchor.filename, imageBuffer);
    return createBufferedReference(ANCHOR_REFERENCE_ID, plannedAnchor.filename, imageBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to generate internal consistency anchor for ${folderName}: ${message}`);
    return undefined;
  }
};

const normalizeUploadMimeType = (mimeType: string): UploadMimeType => {
  const normalizedMimeType = mimeType.trim().toLowerCase() as UploadMimeType;

  if (!SUPPORTED_UPLOAD_MIME_TYPES.includes(normalizedMimeType)) {
    throw new Error(`Unsupported image mime type: ${mimeType}`);
  }

  return normalizedMimeType;
};

const buildUploadedAssetFilename = (assetType: AssetType, mimeType: UploadMimeType): string => {
  const configuredFilename = getAssetConfig(assetType).filename;
  const baseName = configuredFilename.replace(/\.[^.]+$/, '');
  return `${baseName}${UPLOAD_MIME_TO_EXTENSION[mimeType]}`;
};

const buildManualPromptFileInfo = (
  existingFile: GeneratedFileInfo | undefined,
  folderName: string,
  assetType: AssetType,
  fallbackFilename: string,
  prompt: string,
): GeneratedFileInfo => {
  if (!existingFile) {
    return buildPendingFileInfo(folderName, assetType, fallbackFilename, prompt);
  }

  return {
    ...existingFile,
    filename: existingFile.filename || fallbackFilename,
    mimeType: existingFile.mimeType || 'image/png',
    prompt,
    url: `/api/output/${folderName}/${existingFile.filename || fallbackFilename}`,
    status: existingFile.status === 'failed' ? 'pending' : existingFile.status,
    source: existingFile.status === 'generated' ? existingFile.source ?? 'manual_upload' : 'prompt_plan',
    error: undefined,
  };
};

export const createGenerationJob = async (
  inputRequest: CharacterRequest,
): Promise<GenerationJob> => {
  const startedAt = Date.now();
  const request = normalizeCharacterRequest(inputRequest);
  const { provider, model } = getImageGenerationContext(request.provider);
  request.provider = provider;

  const assetTypes = normalizeAssetTypes(request.assetTypes);
  const generationOrder = sortAssetTypesForGeneration(assetTypes);
  const { folderName } = await createOutputFolder(request.characterName, request.outputDirName);
  const promptVariants: Partial<Record<AssetType, string>> = {};
  const files: GeneratedFileInfo[] = [];
  const errors: NonNullable<GenerationJob['errors']> = [];

  if (isManualPromptProvider(provider)) {
    for (const plannedAsset of planAssets(request, generationOrder)) {
      const finalPrompt = buildWorkflowPrompt(provider, plannedAsset.prompt, []);
      promptVariants[plannedAsset.assetType] = finalPrompt;
      files.push(buildPendingFileInfo(folderName, plannedAsset.assetType, plannedAsset.filename, finalPrompt));
    }

    const status = buildStatusFromFiles(files);
    const metadata = createOutputMetadata({
      folderName,
      request: {
        ...request,
        provider,
        assetTypes,
      },
      files,
      promptVariants,
      status,
      durationMs: Date.now() - startedAt,
      model,
    });

    await saveMetadata(folderName, metadata);

    return {
      id: randomId(),
      status,
      folderName,
      request: {
        ...request,
        provider,
        assetTypes,
      },
      files: metadata.files,
      metadata,
    };
  }

  const generatedAssets = new Map<AssetType, BufferedReferenceImage>();
  const anchorReference = await generateAnchorReference(folderName, request, model);

  for (const plannedAsset of planAssets(request, generationOrder)) {
    const referenceImages = buildGenerationReferences(
      plannedAsset.assetType,
      anchorReference,
      generatedAssets,
    );
    const finalPrompt = buildWorkflowPrompt(provider, plannedAsset.prompt, referenceImages);

    promptVariants[plannedAsset.assetType] = finalPrompt;

    try {
      const imageBuffer = await generateImage({
        provider,
        model,
        prompt: finalPrompt,
        size: plannedAsset.size,
        background: plannedAsset.background,
        references: referenceImages.map((reference) => ({
          filename: reference.filename,
          data: reference.data,
          mimeType: reference.mimeType,
        })),
      });

      await saveBinary(folderName, plannedAsset.filename, imageBuffer);
      files.push(
        buildGeneratedFileInfo(
          folderName,
          plannedAsset.assetType,
          plannedAsset.filename,
          finalPrompt,
          imageBuffer,
        ),
      );
      generatedAssets.set(
        plannedAsset.assetType,
        createBufferedReference(plannedAsset.assetType, plannedAsset.filename, imageBuffer),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      files.push(
        buildFailedFileInfo(
          folderName,
          plannedAsset.assetType,
          plannedAsset.filename,
          finalPrompt,
          message,
        ),
      );
      errors.push({
        assetType: plannedAsset.assetType,
        message,
      });
    }
  }

  const status = buildStatusFromFiles(files);
  const metadata = createOutputMetadata({
    folderName,
    request: {
      ...request,
      provider,
      assetTypes,
    },
    files,
    promptVariants,
    status,
    durationMs: Date.now() - startedAt,
    model,
  });

  await saveMetadata(folderName, metadata);

  return {
    id: randomId(),
    status,
    folderName,
    request: {
      ...request,
      provider,
      assetTypes,
    },
    files: metadata.files,
    metadata,
    errors: errors.length ? errors : undefined,
  };
};

export const regenerateAsset = async (
  request: RegenerateAssetRequest,
): Promise<GenerationJob> => {
  const metadata = await readMetadata(request.folderName);
  const characterRequest = loadRequestFromMetadata(metadata, request);
  const { provider, model } = getImageGenerationContext(characterRequest.provider);
  characterRequest.provider = provider;

  const plannedAsset = planAssets(characterRequest, [request.assetType], {
    [request.assetType]: normalizeOptionalText(request.promptOverride),
  })[0];
  const referenceImages = await buildRegenerationReferences(metadata, request.assetType);
  const finalPrompt = buildWorkflowPrompt(provider, plannedAsset.prompt, referenceImages);

  if (isManualPromptProvider(provider)) {
    const existingFile = metadata.files.find((file) => file.assetType === request.assetType);
    const manualFile = buildManualPromptFileInfo(
      existingFile,
      metadata.outputFolder,
      request.assetType,
      plannedAsset.filename,
      finalPrompt,
    );
    const filesAfterReplace = metadata.files
      .filter((file) => file.assetType !== request.assetType)
      .concat(manualFile);
    const status = buildStatusFromFiles(filesAfterReplace);
    const updatedMetadata = replaceFileInMetadata(
      {
        ...metadata,
        provider,
        model,
      },
      manualFile,
      finalPrompt,
      status,
    );

    await saveMetadata(metadata.outputFolder, updatedMetadata);

    return {
      id: randomId(),
      status,
      folderName: metadata.outputFolder,
      request: {
        ...characterRequest,
        provider,
        assetTypes: [...ALL_ASSET_TYPES],
        outputDirName: metadata.outputFolder,
      },
      files: updatedMetadata.files,
      metadata: updatedMetadata,
    };
  }

  const imageBuffer = await generateImage({
    provider,
    model,
    prompt: finalPrompt,
    size: plannedAsset.size,
    background: plannedAsset.background,
    references: referenceImages.map((reference) => ({
      filename: reference.filename,
      data: reference.data,
      mimeType: reference.mimeType,
    })),
  });

  await saveBinary(metadata.outputFolder, plannedAsset.filename, imageBuffer);

  const generatedFile = buildGeneratedFileInfo(
    metadata.outputFolder,
    request.assetType,
    plannedAsset.filename,
    finalPrompt,
    imageBuffer,
  );
  const filesAfterReplace = metadata.files
    .filter((file) => file.assetType !== request.assetType)
    .concat(generatedFile);
  const status = buildStatusFromFiles(filesAfterReplace);
  const updatedMetadata = replaceFileInMetadata(
    {
      ...metadata,
      provider,
      model,
    },
    generatedFile,
    finalPrompt,
    status,
  );

  await saveMetadata(metadata.outputFolder, updatedMetadata);

  return {
    id: randomId(),
    status,
    folderName: metadata.outputFolder,
    request: {
      ...characterRequest,
      provider,
      assetTypes: [...ALL_ASSET_TYPES],
      outputDirName: metadata.outputFolder,
    },
    files: updatedMetadata.files,
    metadata: updatedMetadata,
  };
};

export const uploadAssetImage = async ({
  folderName,
  assetType,
  mimeType,
  imageBuffer,
}: {
  folderName: string;
  assetType: AssetType;
  mimeType: string;
  imageBuffer: Buffer;
}): Promise<GenerationJob> => {
  const metadata = await readMetadata(folderName);
  const normalizedMimeType = normalizeUploadMimeType(mimeType);
  const uploadFilename = buildUploadedAssetFilename(assetType, normalizedMimeType);
  const existingFile = metadata.files.find((file) => file.assetType === assetType);
  const characterRequest = loadRequestFromMetadata(metadata, {
    folderName,
    assetType,
  });
  const fallbackPrompt = planAssets(characterRequest, [assetType])[0]?.prompt;
  const finalPrompt = metadata.promptVariants[assetType] ?? existingFile?.prompt ?? fallbackPrompt ?? '';

  await saveBinary(metadata.outputFolder, uploadFilename, imageBuffer);

  const uploadedFile = buildGeneratedFileInfo(
    metadata.outputFolder,
    assetType,
    uploadFilename,
    finalPrompt,
    imageBuffer,
    normalizedMimeType,
    'manual_upload',
  );
  const filesAfterReplace = metadata.files
    .filter((file) => file.assetType !== assetType)
    .concat(uploadedFile);
  const status = buildStatusFromFiles(filesAfterReplace);
  const updatedMetadata = replaceFileInMetadata(
    {
      ...metadata,
      model: metadata.model,
      provider: resolveImageProvider(metadata.provider),
    },
    uploadedFile,
    finalPrompt,
    status,
  );

  await saveMetadata(metadata.outputFolder, updatedMetadata);

  return {
    id: randomId(),
    status,
    folderName: metadata.outputFolder,
    request: {
      characterName: metadata.characterName,
      description: metadata.description,
      style: metadata.style,
      notes: metadata.notes,
      seed: metadata.seed,
      provider: resolveImageProvider(metadata.provider),
      assetTypes: [...ALL_ASSET_TYPES],
      outputDirName: metadata.outputFolder,
    },
    files: updatedMetadata.files,
    metadata: updatedMetadata,
  };
};


