import express from "express";
import path from "node:path";

import assetsRouter from "./routes/assets.js";
import { generateImageStub } from "./lib/image-service.js";
import { ensureOutputsDir } from "./lib/storage.js";
import { loadLocalEnvFile } from "./lib/env.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/generate", async (req, res) => {
  const characterName = String(req.body?.characterName ?? "");

  if (!characterName.trim()) {
    res.status(400).json({ error: "characterName is required" });
    return;
  }

  try {
    const result = await generateImageStub({ characterName });
    res.status(201).json(result);
  } catch (error) {
    console.error("Failed to generate image metadata", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.use("/api/assets", assetsRouter);

app.use(
  (
    error: Error & { statusCode?: number; details?: unknown },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const statusCode = error.statusCode ?? 500;
    const payload: { error: string; details?: unknown } = {
      error: error.message || "Internal server error",
    };

    if (error.details !== undefined) {
      payload.details = error.details;
    }

    if (statusCode >= 500) {
      console.error("Unhandled server error", error);
    }

    res.status(statusCode).json(payload);
  },
);

app.use(express.static(path.resolve(process.cwd(), "client")));

app.get("*", (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), "client/index.html"));
});

async function start(): Promise<void> {
  await loadLocalEnvFile();
  await ensureOutputsDir();

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

void start();
