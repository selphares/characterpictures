type GeneratePayload = {
  name: string;
  description: string;
  style: string;
  notes: string;
  targetFolder?: string;
};

type OutputItem = {
  folder: string;
  file: string;
  status?: string;
  assetType?: string;
};

const assetTypes = ["portrait", "token", "sprite", "sheet", "icon"];

const form = document.querySelector<HTMLFormElement>("#generate-form");
const refreshOutputsButton = document.querySelector<HTMLButtonElement>("#refresh-outputs");
const assetActionsContainer = document.querySelector<HTMLDivElement>("#asset-actions");
const outputGallery = document.querySelector<HTMLDivElement>("#output-gallery");
const loadingIndicator = document.querySelector<HTMLDivElement>("#loading-indicator");
const successMessage = document.querySelector<HTMLDivElement>("#success-message");
const errorMessage = document.querySelector<HTMLDivElement>("#error-message");
const activityLog = document.querySelector<HTMLUListElement>("#activity-log");

const state = {
  loading: false,
  outputs: [] as OutputItem[],
};

function setLoading(loading: boolean, text = "Lädt…") {
  state.loading = loading;
  if (!loadingIndicator) return;
  loadingIndicator.textContent = text;
  loadingIndicator.classList.toggle("hidden", !loading);
}

function setSuccess(text: string) {
  if (!successMessage) return;
  successMessage.textContent = text;
  successMessage.classList.remove("hidden");
}

function clearSuccess() {
  if (!successMessage) return;
  successMessage.classList.add("hidden");
  successMessage.textContent = "";
}

function setError(text: string) {
  if (!errorMessage) return;
  errorMessage.textContent = text;
  errorMessage.classList.remove("hidden");
}

function clearError() {
  if (!errorMessage) return;
  errorMessage.classList.add("hidden");
  errorMessage.textContent = "";
}

function logActivity(message: string) {
  if (!activityLog) return;
  const item = document.createElement("li");
  item.textContent = `${new Date().toLocaleTimeString()} — ${message}`;
  activityLog.prepend(item);
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request fehlgeschlagen (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function getFormPayload(): GeneratePayload {
  const fd = new FormData(form!);
  return {
    name: String(fd.get("name") || "").trim(),
    description: String(fd.get("description") || "").trim(),
    style: String(fd.get("style") || "").trim(),
    notes: String(fd.get("notes") || "").trim(),
    targetFolder: String(fd.get("targetFolder") || "").trim() || undefined,
  };
}

function getPreviewUrl(item: OutputItem) {
  const folder = encodeURIComponent(item.folder);
  const file = encodeURIComponent(item.file);
  return `/api/output/${folder}/${file}`;
}

function renderOutputCards() {
  if (!outputGallery) return;
  outputGallery.innerHTML = "";

  if (!state.outputs.length) {
    outputGallery.innerHTML = "<p>Keine Outputs vorhanden.</p>";
    return;
  }

  for (const output of state.outputs) {
    const card = document.createElement("article");
    card.className = "output-card";
    card.setAttribute("role", "listitem");

    const previewWrap = document.createElement("div");
    previewWrap.className = "preview-wrap";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = `${output.file} Vorschau`;
    img.src = getPreviewUrl(output);
    img.onerror = () => {
      img.replaceWith(document.createTextNode("Keine Vorschau verfügbar"));
    };

    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.innerHTML = `<strong>${output.file}</strong><br/>Status: ${output.status || "unknown"}`;

    const regenerateButton = document.createElement("button");
    regenerateButton.type = "button";
    regenerateButton.textContent = "Re-Generate";
    regenerateButton.addEventListener("click", () => regenerateSingleOutput(output));

    previewWrap.append(img);
    card.append(previewWrap, meta, regenerateButton);
    outputGallery.append(card);
  }
}

function normalizeOutputs(data: unknown): OutputItem[] {
  if (Array.isArray(data)) {
    return data
      .map((item) => {
        if (typeof item === "object" && item) {
          const it = item as Record<string, unknown>;
          return {
            folder: String(it.folder ?? ""),
            file: String(it.file ?? ""),
            status: it.status ? String(it.status) : undefined,
            assetType: it.assetType ? String(it.assetType) : undefined,
          };
        }
        return null;
      })
      .filter((item): item is OutputItem => Boolean(item?.folder && item?.file));
  }

  if (typeof data === "object" && data && Array.isArray((data as { outputs?: unknown[] }).outputs)) {
    return normalizeOutputs((data as { outputs: unknown[] }).outputs);
  }

  return [];
}

async function loadOutputs() {
  setLoading(true, "Lade Outputs …");
  clearError();
  try {
    const data = await requestJson("/api/list-outputs");
    state.outputs = normalizeOutputs(data);
    renderOutputCards();
    logActivity(`Outputs geladen (${state.outputs.length})`);
  } catch (error) {
    setError(`Outputs konnten nicht geladen werden: ${(error as Error).message}`);
    logActivity("Fehler beim Laden der Outputs");
  } finally {
    setLoading(false);
  }
}

async function generateFullSet() {
  const payload = getFormPayload();
  clearError();
  clearSuccess();
  setLoading(true, "Generiere Full-Set …");

  try {
    await requestJson("/api/generate-full-set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSuccess("Full-Set erfolgreich gestartet.");
    logActivity("Full-Set generiert");
    await loadOutputs();
  } catch (firstError) {
    try {
      await requestJson("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSuccess("Full-Set erfolgreich gestartet.");
      logActivity("Full-Set generiert (Fallback-Endpoint)");
      await loadOutputs();
    } catch (secondError) {
      const message = (secondError as Error).message || (firstError as Error).message;
      setError(`Generierung fehlgeschlagen: ${message}`);
      logActivity("Fehler bei Full-Set Generierung");
    }
  } finally {
    setLoading(false);
  }
}

async function regenerateByAssetType(assetType: string) {
  const payload = { ...getFormPayload(), assetType };
  clearError();
  clearSuccess();
  setLoading(true, `Re-Generate ${assetType} …`);

  try {
    await requestJson(`/api/regenerate/${encodeURIComponent(assetType)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSuccess(`${assetType} erfolgreich neu generiert.`);
    logActivity(`Asset-Typ neu generiert: ${assetType}`);
    await loadOutputs();
  } catch (firstError) {
    try {
      await requestJson("/api/regenerate-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSuccess(`${assetType} erfolgreich neu generiert.`);
      logActivity(`Asset-Typ neu generiert (Fallback): ${assetType}`);
      await loadOutputs();
    } catch (secondError) {
      const message = (secondError as Error).message || (firstError as Error).message;
      setError(`Re-Generate fehlgeschlagen: ${message}`);
      logActivity(`Fehler bei Re-Generate: ${assetType}`);
    }
  } finally {
    setLoading(false);
  }
}

async function regenerateSingleOutput(output: OutputItem) {
  clearError();
  clearSuccess();
  setLoading(true, `Re-Generate ${output.file} …`);

  try {
    await requestJson("/api/regenerate-output", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(output),
    });
    setSuccess(`${output.file} wurde neu generiert.`);
    logActivity(`Einzel-Output neu generiert: ${output.file}`);
    await loadOutputs();
  } catch (error) {
    setError(`Einzel-Re-Generate fehlgeschlagen: ${(error as Error).message}`);
    logActivity(`Fehler bei Einzel-Re-Generate: ${output.file}`);
  } finally {
    setLoading(false);
  }
}

function mountAssetButtons() {
  if (!assetActionsContainer) return;
  assetActionsContainer.innerHTML = "";

  for (const type of assetTypes) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${type} Re-Generate`;
    button.addEventListener("click", () => regenerateByAssetType(type));
    assetActionsContainer.append(button);
  }
}

function wireEvents() {
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await generateFullSet();
  });

  refreshOutputsButton?.addEventListener("click", async () => {
    await loadOutputs();
  });
}

async function init() {
  mountAssetButtons();
  wireEvents();
  await loadOutputs();
}

void init();
