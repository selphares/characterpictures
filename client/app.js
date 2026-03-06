const form = document.querySelector('#generator-form');
const result = document.querySelector('#result');
const status = document.querySelector('#status');
const jobSection = document.querySelector('#job-section');
const jobMeta = document.querySelector('#job-meta');
const assetList = document.querySelector('#asset-list');
const generateBtn = document.querySelector('#generate-btn');

let currentJob = null;

const escapeHtml = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const setStatus = (message, kind = 'info') => {
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
};

const asJson = async (response) => {
  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error ?? payload?.message ?? 'Request failed';
    throw new Error(message);
  }

  return payload;
};

const renderJob = (job) => {
  if (!jobMeta || !assetList || !jobSection) return;

  jobSection.classList.remove('hidden');
  const countInfo = Number.isInteger(job?.metadata?.count) ? Number(job.metadata.count) : 1;

  jobMeta.innerHTML = `
    <p><strong>Job-ID:</strong> <code>${escapeHtml(job.id)}</code></p>
    <p><strong>Status:</strong> ${escapeHtml(job.status)}</p>
    <p><strong>Erstellt:</strong> ${new Date(job.metadata.generatedAt).toLocaleString('de-DE')}</p>
    <p><strong>Varianten pro Typ:</strong> ${escapeHtml(countInfo)}</p>
  `;

  assetList.innerHTML = '';

  for (const file of job.files) {
    const item = document.createElement('li');
    item.className = 'asset-item';
    const imageMarkup = file.error
      ? `<p class="asset-error"><strong>Fehler:</strong> ${escapeHtml(file.error)}</p>`
      : `<img class="asset-image" src="${escapeHtml(file.url)}" alt="${escapeHtml(file.type)} preview" loading="lazy" />`;

    const variantMarkup = Number.isInteger(file.variant)
      ? `<p><strong>Variante:</strong> ${escapeHtml(file.variant)}</p>`
      : '';

    item.innerHTML = `
      <div class="asset-details">
        <h3>${escapeHtml(file.type)}</h3>
        ${variantMarkup}
        <p><strong>Datei:</strong> ${escapeHtml(file.filename)}</p>
        <p><strong>ID:</strong> <code>${escapeHtml(file.id)}</code></p>
        ${imageMarkup}
      </div>
      <button type="button" data-file-id="${escapeHtml(file.id)}" data-asset-type="${escapeHtml(file.type)}">Neu generieren</button>
    `;

    const button = item.querySelector('button');
    button?.addEventListener('click', () => regenerate(file));
    assetList.append(item);
  }
};

const regenerate = async (file) => {
  if (!currentJob || !generateBtn) return;

  const promptOverride = window.prompt(
    `Optional neuen Prompt fur ${file.type} eingeben:`,
    currentJob.request.prompt,
  );

  generateBtn.disabled = true;
  setStatus(`Regeneriere ${file.type} ...`, 'info');

  try {
    const regenerated = await asJson(
      await fetch('/api/assets/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: currentJob.id,
          fileId: file.id,
          assetType: file.type,
          promptOverride: promptOverride || undefined,
          seed: currentJob.request.seed,
        }),
      }),
    );

    currentJob.files = currentJob.files.map((entry) =>
      entry.id === file.id ? regenerated : entry,
    );

    renderJob(currentJob);
    result.textContent = JSON.stringify(
      { action: 'regenerate', file, regenerated, jobId: currentJob.id },
      null,
      2,
    );
    setStatus(`${file.type} wurde neu generiert.`, 'success');
  } catch (error) {
    setStatus(`Regeneration fehlgeschlagen: ${error.message}`, 'error');
  } finally {
    generateBtn.disabled = false;
  }
};

if (form && result && generateBtn) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const prompt = String(formData.get('prompt') ?? '').trim();
    const style = String(formData.get('style') ?? '').trim();
    const seedText = String(formData.get('seed') ?? '').trim();
    const countText = String(formData.get('count') ?? '').trim();
    const assetTypes = formData.getAll('assetTypes').map(String);

    if (!prompt || assetTypes.length === 0) {
      setStatus('Bitte Prompt und mindestens einen Asset-Typ eingeben.', 'error');
      return;
    }

    const parsedCount = countText ? Number(countText) : 1;
    if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 8) {
      setStatus('Bitte eine Variantenanzahl zwischen 1 und 8 eingeben.', 'error');
      return;
    }

    const payload = {
      prompt,
      style: style || undefined,
      seed: seedText ? Number(seedText) : undefined,
      count: parsedCount,
      assetTypes,
    };

    generateBtn.disabled = true;
    setStatus('Generierung lauft ...', 'info');
    result.textContent = 'Lade...';

    try {
      currentJob = await asJson(
        await fetch('/api/assets/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }),
      );

      renderJob(currentJob);
      result.textContent = JSON.stringify(currentJob, null, 2);
      setStatus('Assets erfolgreich generiert.', 'success');
    } catch (error) {
      setStatus(`Fehler bei der Generierung: ${error.message}`, 'error');
      result.textContent = `Fehler: ${String(error)}`;
    } finally {
      generateBtn.disabled = false;
    }
  });
}
