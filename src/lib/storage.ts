import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUTS_DIR = process.env.OUTPUTS_DIR ?? "outputs";

export async function ensureOutputsDir(): Promise<string> {
  const absoluteDir = path.resolve(process.cwd(), OUTPUTS_DIR);
  await mkdir(absoluteDir, { recursive: true });
  return absoluteDir;
}

export async function saveJson(filename: string, data: unknown): Promise<string> {
  const outputDir = await ensureOutputsDir();
  const target = path.join(outputDir, `${filename}.json`);
  await writeFile(target, JSON.stringify(data, null, 2), "utf-8");
  return target;
}
