import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { URL } from "node:url";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? "3000");
const OUTPUTS_DIR = path.resolve(process.env.OUTPUTS_DIR ?? "outputs");

const ALLOWED_STYLE_PRESETS = ["fantasy", "pixel", "comic", "realistic"] as const;
const ALLOWED_ASSET_TYPES = ["portrait", "sprite", "token", "background"] as const;

type StylePreset = (typeof ALLOWED_STYLE_PRESETS)[number];
type AssetType = (typeof ALLOWED_ASSET_TYPES)[number];

export interface CharacterRequest {
  characterId: string;
  prompt: string;
  stylePreset: StylePreset;
  assetTypes: AssetType[];
  count: number;
  seed?: number;
  negativePrompt?: string;
  metadata?: Record<string, string>;
}

export interface GeneratedAsset {
  assetType: AssetType;
  fileName: string;
  filePath: string;
}

export interface GenerateSetResponse {
  ok: true;
  runId: string;
  folder: string;
  assets: GeneratedAsset[];
}

export interface RegenerateAssetRequest {
  folder: string;
  assetType: AssetType;
  promptOverride?: string;
  seed?: number;
}

export interface RegenerateAssetResponse {
  ok: true;
  folder: string;
  regeneratedAsset: GeneratedAsset;
}

interface OutputFolderEntry {
  folder: string;
  files: string[];
  metadataAvailable: boolean;
}

interface ListOutputsResponse {
  ok: true;
  outputs: OutputFolderEntry[];
}

interface MetadataResponse {
  ok: true;
  folder: string;
  metadata: Record<string, unknown>;
}

interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly publicMessage: string,
    readonly details?: unknown,
  ) {
    super(publicMessage);
  }
}

function sendJson<T>(res: ServerResponse, status: number, body: T): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function sendApiError(res: ServerResponse, error: HttpError | Error): void {
  if (error instanceof HttpError) {
    const response: ApiError = {
      ok: false,
      error: {
        code: error.code,
        message: error.publicMessage,
        ...(error.details ? { details: error.details } : {}),
      },
    };
    sendJson(res, error.status, response);
    return;
  }

  const response: ApiError = {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    },
  };
  sendJson(res, 500, response);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const rawBody = Buffer.concat(chunks).toString("utf-8");
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateCharacterRequest(input: unknown): CharacterRequest {
  if (!isObject(input)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid request payload.", {
      field: "body",
      reason: "Must be an object.",
    });
  }

  const { characterId, prompt, stylePreset, assetTypes, count, seed, negativePrompt, metadata } = input;

  if (!isNonEmptyString(characterId)) {
    throw new HttpError(422, "VALIDATION_ERROR", "characterId is required.", { field: "characterId" });
  }
  if (!isNonEmptyString(prompt)) {
    throw new HttpError(422, "VALIDATION_ERROR", "prompt is required.", { field: "prompt" });
  }
  if (typeof stylePreset !== "string" || !ALLOWED_STYLE_PRESETS.includes(stylePreset as StylePreset)) {
    throw new HttpError(422, "VALIDATION_ERROR", "stylePreset is invalid.", {
      field: "stylePreset",
      allowed: ALLOWED_STYLE_PRESETS,
    });
  }
  if (
    !Array.isArray(assetTypes) ||
    assetTypes.length === 0 ||
    assetTypes.some((item) => typeof item !== "string" || !ALLOWED_ASSET_TYPES.includes(item as AssetType))
  ) {
    throw new HttpError(422, "VALIDATION_ERROR", "assetTypes must be a non-empty list of valid asset types.", {
      field: "assetTypes",
      allowed: ALLOWED_ASSET_TYPES,
    });
  }
  if (!Number.isInteger(count) || (count as number) < 1 || (count as number) > 10) {
    throw new HttpError(422, "VALIDATION_ERROR", "count must be an integer between 1 and 10.", {
      field: "count",
    });
  }
  if (seed !== undefined && (!Number.isInteger(seed) || (seed as number) < 0)) {
    throw new HttpError(422, "VALIDATION_ERROR", "seed must be a non-negative integer.", { field: "seed" });
  }
  if (negativePrompt !== undefined && typeof negativePrompt !== "string") {
    throw new HttpError(422, "VALIDATION_ERROR", "negativePrompt must be a string.", {
      field: "negativePrompt",
    });
  }
  if (
    metadata !== undefined &&
    (!isObject(metadata) || Object.values(metadata).some((value) => typeof value !== "string"))
  ) {
    throw new HttpError(422, "VALIDATION_ERROR", "metadata must be an object with string values.", {
      field: "metadata",
    });
  }

  return {
    characterId,
    prompt,
    stylePreset: stylePreset as StylePreset,
    assetTypes: assetTypes as AssetType[],
    count: count as number,
    ...(seed !== undefined ? { seed: seed as number } : {}),
    ...(negativePrompt !== undefined ? { negativePrompt: negativePrompt as string } : {}),
    ...(metadata !== undefined ? { metadata: metadata as Record<string, string> } : {}),
  };
}

function validateRegenerateAssetRequest(input: unknown): RegenerateAssetRequest {
  if (!isObject(input)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid request payload.", {
      field: "body",
      reason: "Must be an object.",
    });
  }

  const { folder, assetType, promptOverride, seed } = input;

  if (!isNonEmptyString(folder)) {
    throw new HttpError(422, "VALIDATION_ERROR", "folder is required.", { field: "folder" });
  }
  if (typeof assetType !== "string" || !ALLOWED_ASSET_TYPES.includes(assetType as AssetType)) {
    throw new HttpError(422, "VALIDATION_ERROR", "assetType is invalid.", {
      field: "assetType",
      allowed: ALLOWED_ASSET_TYPES,
    });
  }
  if (promptOverride !== undefined && typeof promptOverride !== "string") {
    throw new HttpError(422, "VALIDATION_ERROR", "promptOverride must be a string.", {
      field: "promptOverride",
    });
  }
  if (seed !== undefined && (!Number.isInteger(seed) || (seed as number) < 0)) {
    throw new HttpError(422, "VALIDATION_ERROR", "seed must be a non-negative integer.", { field: "seed" });
  }

  return {
    folder,
    assetType: assetType as AssetType,
    ...(promptOverride !== undefined ? { promptOverride: promptOverride as string } : {}),
    ...(seed !== undefined ? { seed: seed as number } : {}),
  };
}

function validatePathSegment(value: string, fieldName: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new HttpError(400, "INVALID_PATH", `${fieldName} contains invalid characters.`);
  }
  return value;
}

async function safePathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function handleGenerateSet(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const payload = validateCharacterRequest(await readJsonBody(req));
  const runId = `run_${Date.now()}`;
  const folder = `${payload.characterId}_${runId}`;
  const folderPath = path.join(OUTPUTS_DIR, folder);

  await fs.mkdir(folderPath, { recursive: true });

  const assets: GeneratedAsset[] = payload.assetTypes.map((assetType, index) => {
    const fileName = `${assetType}-${index + 1}.png`;
    const filePath = path.join(folderPath, fileName);
    return { assetType, fileName, filePath };
  });

  await Promise.all(
    assets.map(async ({ filePath }) => {
      await fs.writeFile(filePath, "", "utf-8");
    }),
  );

  const metadata = {
    characterRequest: payload,
    generatedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(folderPath, "metadata.json"), JSON.stringify(metadata, null, 2), "utf-8");

  const response: GenerateSetResponse = {
    ok: true,
    runId,
    folder,
    assets,
  };
  sendJson(res, 201, response);
}

async function handleRegenerateAsset(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const payload = validateRegenerateAssetRequest(await readJsonBody(req));
  const folderName = validatePathSegment(payload.folder, "folder");
  const folderPath = path.join(OUTPUTS_DIR, folderName);

  if (!(await safePathExists(folderPath))) {
    throw new HttpError(404, "NOT_FOUND", "Output folder not found.");
  }

  const fileName = `${payload.assetType}-regenerated-${Date.now()}.png`;
  const filePath = path.join(folderPath, fileName);
  await fs.writeFile(filePath, "", "utf-8");

  const response: RegenerateAssetResponse = {
    ok: true,
    folder: folderName,
    regeneratedAsset: {
      assetType: payload.assetType,
      fileName,
      filePath,
    },
  };

  sendJson(res, 200, response);
}

async function handleListOutputs(res: ServerResponse): Promise<void> {
  await fs.mkdir(OUTPUTS_DIR, { recursive: true });
  const entries = await fs.readdir(OUTPUTS_DIR, { withFileTypes: true });

  const outputs: OutputFolderEntry[] = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const folderPath = path.join(OUTPUTS_DIR, entry.name);
        const files = await fs.readdir(folderPath);
        return {
          folder: entry.name,
          files: files.filter((file) => file !== "metadata.json"),
          metadataAvailable: files.includes("metadata.json"),
        };
      }),
  );

  const response: ListOutputsResponse = {
    ok: true,
    outputs,
  };

  sendJson(res, 200, response);
}

async function handleGetOutputFile(res: ServerResponse, folder: string, file: string): Promise<void> {
  const folderName = validatePathSegment(folder, "folder");
  const fileName = validatePathSegment(file, "file");

  const filePath = path.join(OUTPUTS_DIR, folderName, fileName);
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(path.normalize(path.join(OUTPUTS_DIR, folderName)))) {
    throw new HttpError(400, "INVALID_PATH", "Invalid path.");
  }

  if (!(await safePathExists(normalized))) {
    throw new HttpError(404, "NOT_FOUND", "Output file not found.");
  }

  const content = await fs.readFile(normalized);
  res.statusCode = 200;
  res.setHeader("content-type", "application/octet-stream");
  res.end(content);
}

async function handleGetMetadata(res: ServerResponse, folder: string): Promise<void> {
  const folderName = validatePathSegment(folder, "folder");
  const metadataPath = path.join(OUTPUTS_DIR, folderName, "metadata.json");

  if (!(await safePathExists(metadataPath))) {
    throw new HttpError(404, "NOT_FOUND", "Metadata not found.");
  }

  let metadata: Record<string, unknown>;
  try {
    metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8")) as Record<string, unknown>;
  } catch {
    throw new HttpError(500, "INVALID_METADATA", "Metadata could not be read.");
  }

  const response: MetadataResponse = {
    ok: true,
    folder: folderName,
    metadata,
  };
  sendJson(res, 200, response);
}

async function routeRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!req.url || !req.method) {
    throw new HttpError(400, "BAD_REQUEST", "Invalid request.");
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "POST" && url.pathname === "/api/generate-set") {
    await handleGenerateSet(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/regenerate-asset") {
    await handleRegenerateAsset(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/list-outputs") {
    await handleListOutputs(res);
    return;
  }

  const outputFileMatch = url.pathname.match(/^\/api\/output\/([^/]+)\/([^/]+)$/);
  if (req.method === "GET" && outputFileMatch) {
    await handleGetOutputFile(res, outputFileMatch[1], outputFileMatch[2]);
    return;
  }

  const metadataMatch = url.pathname.match(/^\/api\/output\/([^/]+)\/metadata$/);
  if (req.method === "GET" && metadataMatch) {
    await handleGetMetadata(res, metadataMatch[1]);
    return;
  }

  throw new HttpError(404, "NOT_FOUND", "Route not found.");
}

const server = createServer(async (req, res) => {
  try {
    await routeRequest(req, res);
  } catch (error) {
    sendApiError(res, error as Error);
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on http://${HOST}:${PORT}`);
});

export default server;
