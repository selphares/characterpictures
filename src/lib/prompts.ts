import { ALL_ASSET_TYPES, AssetType, CharacterRequest } from '../types.js';

export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
export type ImageBackground = 'transparent' | 'opaque' | 'auto';

export interface NormalizationPlan {
  targetCanvas: {
    width: number;
    height: number;
  };
  layout: string;
  notes: string[];
}

export interface PlannedAsset {
  assetType: AssetType;
  filename: string;
  prompt: string;
  size: ImageSize;
  background: ImageBackground;
  normalization: NormalizationPlan;
}

export interface PlannedAnchorAsset {
  filename: string;
  prompt: string;
  size: ImageSize;
  background: ImageBackground;
  normalization: NormalizationPlan;
}

interface AssetPromptConfig {
  filename: string;
  size: ImageSize;
  background: ImageBackground;
  assetInstruction: string;
  normalization: NormalizationPlan;
}

const CORE_RULES = [
  'RPG Maker MZ production asset set.',
  'Keep the exact same single character identity across every asset.',
  'Same face, hair, eye color, outfit, accessories, species, age impression, and palette in every image.',
  'No extra characters, no random props, no text, no watermark, no logo, no UI.',
  'Keep the composition clean and game-ready.',
  'Use anime JRPG art with clean linework and readable cel shading unless the user asks for another style.',
  'For animation sheets, use equal cell size, stable camera framing, and keep the character at consistent scale in every frame.',
];

const SPRITE_ASSET_TYPES: AssetType[] = [
  'walk_down',
  'walk_left',
  'walk_right',
  'walk_up',
  'battler',
  'battler_attack',
];

const SPRITE_SHEET_RULES = [
  'consistent character sheet',
  'same character model sheet reference',
  'clean JRPG sprite sheet style',
  'game-ready production sprite sheet',
  'consistent proportions across all frames',
];

const ANCHOR_FILENAME = 'consistency_anchor.png';

const ANCHOR_NORMALIZATION: NormalizationPlan = {
  targetCanvas: { width: 1024, height: 1024 },
  layout: '2 columns x 2 rows turnaround model sheet',
  notes: [
    'Internal consistency anchor for later asset generation.',
    'Show front, left, right, and back views with matching scale and outfit details.',
  ],
};

const ASSET_CONFIG: Record<AssetType, AssetPromptConfig> = {
  walk_down: {
    filename: 'walk_down.png',
    size: '1024x1536',
    background: 'transparent',
    assetInstruction:
      'Create one full 9-frame walk cycle for the down direction only. Show exactly 9 full-body animation frames arranged in a 3 by 3 grid, sequential loop order from top-left to bottom-right, facing down toward the viewer, transparent background.',
    normalization: {
      targetCanvas: { width: 576, height: 864 },
      layout: '3 columns x 3 rows walk cycle sheet',
      notes: [
        'Prepare for later RPG Maker animation packing.',
        'Keep equal frame spacing and full silhouette in every frame.',
      ],
    },
  },
  walk_left: {
    filename: 'walk_left.png',
    size: '1024x1536',
    background: 'transparent',
    assetInstruction:
      'Create one full 9-frame walk cycle for the left direction only. Show exactly 9 full-body animation frames arranged in a 3 by 3 grid, sequential loop order from top-left to bottom-right, facing left in side view, transparent background. Keep the whole body including sandals, toes, heels, tail tip, and hair fully visible in every frame. Scale the character slightly smaller so every frame has safe empty padding around the silhouette, especially below the feet.',
    normalization: {
      targetCanvas: { width: 576, height: 864 },
      layout: '3 columns x 3 rows walk cycle sheet',
      notes: [
        'Prepare for later RPG Maker animation packing.',
        'Keep equal frame spacing and full silhouette in every frame.',
      ],
    },
  },
  walk_right: {
    filename: 'walk_right.png',
    size: '1024x1536',
    background: 'transparent',
    assetInstruction:
      'Create one full 9-frame walk cycle for the right direction only. Show exactly 9 full-body animation frames arranged in a 3 by 3 grid, sequential loop order from top-left to bottom-right, facing right in side view, transparent background. Keep the whole body including sandals, toes, heels, tail tip, and hair fully visible in every frame. Scale the character slightly smaller so every frame has safe empty padding around the silhouette, especially below the feet.',
    normalization: {
      targetCanvas: { width: 576, height: 864 },
      layout: '3 columns x 3 rows walk cycle sheet',
      notes: [
        'Prepare for later RPG Maker animation packing.',
        'Keep equal frame spacing and full silhouette in every frame.',
      ],
    },
  },
  walk_up: {
    filename: 'walk_up.png',
    size: '1024x1536',
    background: 'transparent',
    assetInstruction:
      'Create one full 9-frame walk cycle for the up direction only. Show exactly 9 full-body animation frames arranged in a 3 by 3 grid, sequential loop order from top-left to bottom-right, character viewed from the back while facing up, transparent background.',
    normalization: {
      targetCanvas: { width: 576, height: 864 },
      layout: '3 columns x 3 rows walk cycle sheet',
      notes: [
        'Prepare for later RPG Maker animation packing.',
        'Keep equal frame spacing and full silhouette in every frame.',
      ],
    },
  },
  battler: {
    filename: 'battler.png',
    size: '1024x1536',
    background: 'transparent',
    assetInstruction:
      'Create one side-view SV battler idle loop sheet. Show exactly 9 full-body animation frames arranged in a 3 by 3 grid, sequential loop order from top-left to bottom-right, character facing left, staying in place, transparent background. This must be a combat-ready idle loop with visible motion: breathing, torso sway, guard-hand movement, cloth sway, hair sway, and tail motion. Do not make the character walk or step forward; keep the feet anchored in a ready stance while the upper body and costume show subtle looping movement.',
    normalization: {
      targetCanvas: { width: 576, height: 864 },
      layout: '3 columns x 3 rows SV battler idle sheet',
      notes: ['Keep the character anchored in place across all idle frames.'],
    },
  },
  battler_attack: {
    filename: 'battler_attack.png',
    size: '1024x1536',
    background: 'transparent',
    assetInstruction:
      'Create one side-view SV battler attack loop sheet. Show exactly 9 full-body animation frames arranged in a 3 by 3 grid, sequential loop order from top-left to bottom-right, character facing left, attack motion from ready to strike to recover, transparent background.',
    normalization: {
      targetCanvas: { width: 576, height: 864 },
      layout: '3 columns x 3 rows SV battler attack sheet',
      notes: ['Keep the character scale consistent with the idle battler sheet.'],
    },
  },
  faces: {
    filename: 'faces.png',
    size: '1536x1024',
    background: 'opaque',
    assetInstruction:
      'Create one RPG-style faceset sheet with exactly 8 square head-and-shoulders portraits of the same character in a 4 by 2 grid. Expressions: neutral, happy, sad, angry, surprised, thinking, determined, hurt. Keep framing and scale consistent.',
    normalization: {
      targetCanvas: { width: 576, height: 288 },
      layout: '4 columns x 2 rows faceset',
      notes: ['Keep each face in a clean square area for later cropping.'],
    },
  },
  portrait: {
    filename: 'portrait.png',
    size: '1024x1536',
    background: 'transparent',
    assetInstruction:
      'Create one large portrait or bust image from chest to head, expressive but clean JRPG dialogue portrait, same design details, no extra props.',
    normalization: {
      targetCanvas: { width: 768, height: 1024 },
      layout: 'single portrait',
      notes: ['Leave clean edges for later canvas fitting.'],
    },
  },
  base_fullbody: {
    filename: 'base_fullbody.png',
    size: '1024x1536',
    background: 'transparent',
    assetInstruction:
      'Create one neutral front-facing full-body reference image, complete silhouette visible from head to toe with small margin, transparent background.',
    normalization: {
      targetCanvas: { width: 768, height: 1152 },
      layout: 'single full-body reference',
      notes: ['Use this asset as the canonical design reference for all other assets.'],
    },
  },
};

const joinSections = (sections: Array<string | undefined>): string => {
  return sections.filter((value): value is string => Boolean(value && value.trim())).join('\n');
};

const buildCorePrompt = (request: CharacterRequest): string => {
  return joinSections([
    `Character name: ${request.characterName}.`,
    `Character description: ${request.description}.`,
    request.style ? `Style description: ${request.style}.` : undefined,
    request.notes ? `Additional notes: ${request.notes}.` : undefined,
    `Core rules: ${CORE_RULES.join(' ')}`,
  ]);
};

export const getDefaultAssetTypes = (): AssetType[] => [...ALL_ASSET_TYPES];

export const getConsistencyAnchorFilename = (): string => ANCHOR_FILENAME;

export const getAssetConfig = (assetType: AssetType): AssetPromptConfig => {
  return ASSET_CONFIG[assetType];
};

export const buildConsistencyAnchorPrompt = (request: CharacterRequest): string => {
  return joinSections([
    buildCorePrompt(request),
    'Asset type: consistency_anchor.',
    'Asset-specific instruction: Create one canonical character turnaround model sheet for consistency locking. Show exactly 4 full-body views of the same character arranged in a 2 by 2 grid: front view, left side view, right side view, and back view. Neutral standing pose, same scale in every panel, complete silhouette fully visible, transparent background.',
    'This turnaround sheet is the definitive source of truth for face, hair, body proportions, species traits, outfit shape, accessories, and palette.',
    'Generate exactly one PNG image.',
  ]);
};

export const buildAssetPrompt = (
  request: CharacterRequest,
  assetType: AssetType,
  promptOverride?: string,
): string => {
  const config = getAssetConfig(assetType);
  const spriteSheetRules = SPRITE_ASSET_TYPES.includes(assetType)
    ? `Sprite sheet consistency requirements: ${SPRITE_SHEET_RULES.join('. ')}.`
    : undefined;

  return joinSections([
    buildCorePrompt(request),
    `Asset type: ${assetType}.`,
    spriteSheetRules,
    `Asset-specific instruction: ${config.assetInstruction}`,
    promptOverride ? `Asset-specific override: ${promptOverride}.` : undefined,
    'Generate exactly one PNG image.',
  ]);
};

export const buildManualPromptEnvelope = (
  prompt: string,
  referenceFilenames: string[] = [],
): string => {
  const referenceLine = referenceFilenames.length
    ? `Attach these existing reference images before generating: ${referenceFilenames.join(', ')}.`
    : 'If possible, create base_fullbody and portrait first, add them to the set, then reuse them as references for the remaining assets.';

  return joinSections([
    referenceLine,
    prompt,
    'Consistency lock: keep the exact same character identity. Do not redesign the face, silhouette, proportions, outfit, palette, or species traits.',
  ]);
};

export const planConsistencyAnchor = (request: CharacterRequest): PlannedAnchorAsset => {
  return {
    filename: ANCHOR_FILENAME,
    prompt: buildConsistencyAnchorPrompt(request),
    size: '1024x1536',
    background: 'transparent',
    normalization: ANCHOR_NORMALIZATION,
  };
};

export const planAssets = (
  request: CharacterRequest,
  assetTypes: AssetType[] = getDefaultAssetTypes(),
  promptOverrides: Partial<Record<AssetType, string>> = {},
): PlannedAsset[] => {
  return assetTypes.map((assetType) => {
    const config = getAssetConfig(assetType);

    return {
      assetType,
      filename: config.filename,
      prompt: buildAssetPrompt(request, assetType, promptOverrides[assetType]),
      size: config.size,
      background: config.background,
      normalization: config.normalization,
    };
  });
};