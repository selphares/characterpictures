export const DEFAULT_PROMPT = "Create a colorful fantasy character portrait.";

export function buildPrompt(characterName: string): string {
  const safeName = characterName.trim() || "Unknown Hero";
  return `${DEFAULT_PROMPT} Subject: ${safeName}.`;
}
