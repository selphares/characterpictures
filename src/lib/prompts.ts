export type AssetType =
  | 'walk_down'
  | 'walk_left'
  | 'walk_right'
  | 'walk_up'
  | 'battler'
  | 'faces'
  | 'portrait'
  | 'base_fullbody';

export type PromptVariant =
  | 'core_character'
  | 'core_style'
  | 'core_hints'
  | 'asset_walk_down'
  | 'asset_walk_left'
  | 'asset_walk_right'
  | 'asset_walk_up'
  | 'asset_battler'
  | 'asset_faces'
  | 'asset_portrait'
  | 'asset_base_fullbody';

export interface CharacterPromptInput {
  character: string;
  style: string;
  hints?: string[];
}

export interface PromptBuildResult {
  assetType: AssetType;
  prompt: string;
  metadata: {
    promptVariants: PromptVariant[];
  };
}

const GUARDRAILS = [
  'Use one single character only; do not add extra people, companions, or background figures.',
  'Keep character-defining traits consistent (face shape, hair, colors, clothing silhouette, accessories).',
  'Do not invent random props, weapons, furniture, logos, text, or scene objects unless explicitly requested.',
  'Avoid random background storytelling elements that change the character concept.',
] as const;

const FULL_FIGURE_RULE =
  'The full figure must be completely visible from head to toe, including feet and hands, with no body part cropped.';

function buildCorePrompt({ character, style, hints = [] }: CharacterPromptInput): string {
  const hintBlock = hints.length > 0 ? `Additional hints: ${hints.join('; ')}.` : '';

  return [
    `Character concept: ${character}.`,
    `Visual style: ${style}.`,
    hintBlock,
    'Preserve identity across all generated assets for this character.',
    ...GUARDRAILS,
  ]
    .filter(Boolean)
    .join(' ');
}

function assetPromptLine(assetType: AssetType): { line: string; variant: PromptVariant } {
  switch (assetType) {
    case 'walk_down':
      return {
        line: `Asset target: walk_down sprite. Front-facing walking cycle, readable downward movement, neutral transparent background. ${FULL_FIGURE_RULE}`,
        variant: 'asset_walk_down',
      };
    case 'walk_left':
      return {
        line: `Asset target: walk_left sprite. Left-facing walking cycle, consistent proportions to other walk directions, neutral transparent background. ${FULL_FIGURE_RULE}`,
        variant: 'asset_walk_left',
      };
    case 'walk_right':
      return {
        line: `Asset target: walk_right sprite. Right-facing walking cycle, mirrored logic from left while keeping design details correct, neutral transparent background. ${FULL_FIGURE_RULE}`,
        variant: 'asset_walk_right',
      };
    case 'walk_up':
      return {
        line: `Asset target: walk_up sprite. Back-facing walking cycle, keep costume and silhouette recognizable from behind, neutral transparent background. ${FULL_FIGURE_RULE}`,
        variant: 'asset_walk_up',
      };
    case 'battler':
      return {
        line: 'Asset target: battler. Dynamic combat-ready stance of the same character, no additional enemies/allies, clean composition focused on the character only.',
        variant: 'asset_battler',
      };
    case 'faces':
      return {
        line: 'Asset target: faces sheet. Multiple facial expressions of the same character identity, consistent hairstyle and proportions, tightly framed head/upper bust.',
        variant: 'asset_faces',
      };
    case 'portrait':
      return {
        line: 'Asset target: portrait. High-detail portrait of the same character, no extra figures, no random prop additions, expression-driven framing.',
        variant: 'asset_portrait',
      };
    case 'base_fullbody':
      return {
        line: `Asset target: base_fullbody. Neutral standing fullbody reference for the character. ${FULL_FIGURE_RULE}`,
        variant: 'asset_base_fullbody',
      };
    default: {
      const exhaustive: never = assetType;
      throw new Error(`Unsupported asset type: ${String(exhaustive)}`);
    }
  }
}

export function buildAssetPrompt(assetType: AssetType, input: CharacterPromptInput): PromptBuildResult {
  const corePrompt = buildCorePrompt(input);
  const { line, variant } = assetPromptLine(assetType);

  return {
    assetType,
    prompt: `${corePrompt} ${line}`,
    metadata: {
      promptVariants: ['core_character', 'core_style', 'core_hints', variant],
    },
  };
}
