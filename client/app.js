const ASSET_ORDER = [
  'walk_down',
  'walk_left',
  'walk_right',
  'walk_up',
  'battler',
  'battler_attack',
  'faces',
  'portrait',
  'base_fullbody',
];

const ASSET_LABELS = {
  walk_down: 'Walk Down',
  walk_left: 'Walk Left',
  walk_right: 'Walk Right',
  walk_up: 'Walk Up',
  battler: 'SV Battler Idle',
  battler_attack: 'SV Battler Attack',
  faces: 'Faces',
  portrait: 'Portrait',
  base_fullbody: 'Base Fullbody',
};

const form = document.querySelector('#generator-form');
const generateBtn = document.querySelector('#generate-btn');
const refreshOutputsBtn = document.querySelector('#refresh-outputs');
const outputsList = document.querySelector('#outputs-list');
const actionsPanel = document.querySelector('#actions-panel');
const assetActions = document.querySelector('#asset-actions');
const previewPanel = document.querySelector('#preview-panel');
const previewTitle = document.querySelector('#preview-title');
const jobMeta = document.querySelector('#job-meta');
const assetList = document.querySelector('#asset-list');
const result = document.querySelector('#result');
const statusBox = document.querySelector('#status-box');
const statusMessage = document.querySelector('#status-message');
const statusDetail = document.querySelector('#status-detail');
const providerSelect = document.querySelector('#provider');
const providerHint = document.querySelector('#provider-hint');

let currentJob = null;
let currentOutputs = [];
let currentProviders = [];
let defaultProvider = 'openai';

const escapeHtml = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const assetLabel = (assetType) => ASSET_LABELS[assetType] || assetType;

const formatDate = (value) => {
  if (!value) {
    return 'unbekannt';
  }

  return new Date(value).toLocaleString('de-DE');
};

const formatDimensions = (file) => {
  if (!file || !Number.isInteger(file.width) || !Number.isInteger(file.height)) {
    return 'unbekannt';
  }

  return `${file.width} x ${file.height}`;
};

const setStatus = (message, kind = 'info', detail = '') => {
  if (statusMessage) {
    statusMessage.textContent = message;
  }

  if (statusDetail) {
    statusDetail.textContent = detail;
  }

  if (statusBox) {
    statusBox.dataset.kind = kind;
  }
};

const asJson = async (response) => {
  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error ?? payload?.message ?? 'Request failed';
    throw new Error(message);
  }

  return payload;
};

const getProviderById = (providerId) => {
  return currentProviders.find((entry) => entry.id === providerId) || null;
};

const getPreferredProvider = (providerId) => {
  if (providerId && currentProviders.some((entry) => entry.id === providerId)) {
    return providerId;
  }

  const configuredProvider = currentProviders.find((entry) => entry.configured);
  return configuredProvider?.id || defaultProvider;
};

const updateProviderHint = () => {
  if (!providerHint || !providerSelect) {
    return;
  }

  const selectedProvider = getProviderById(providerSelect.value);
  if (!selectedProvider) {
    providerHint.textContent = 'Kein Bildprovider verfugbar.';
    return;
  }

  const status = selectedProvider.configured
    ? `konfiguriert uber ${selectedProvider.keyEnvVar}`
    : `nicht konfiguriert, erwartet ${selectedProvider.keyEnvVar}`;

  providerHint.textContent = `${selectedProvider.label} | Modell: ${selectedProvider.model} | ${status}. ${selectedProvider.summary}`;
};

const renderProviderOptions = (preferredProvider) => {
  if (!providerSelect) {
    return;
  }

  const selectedProvider = getPreferredProvider(preferredProvider);
  providerSelect.innerHTML = currentProviders
    .map((provider) => {
      const disabled = provider.configured ? '' : 'disabled';
      const suffix = provider.configured ? '' : ' (Key fehlt)';
      return `<option value="${escapeHtml(provider.id)}" ${disabled}>${escapeHtml(provider.label + suffix)}</option>`;
    })
    .join('');

  if (currentProviders.some((provider) => provider.id === selectedProvider)) {
    providerSelect.value = selectedProvider;
  }

  updateProviderHint();
};

const loadProviders = async () => {
  const payload = await asJson(await fetch('/api/providers'));
  currentProviders = payload.providers || [];
  defaultProvider = payload.defaultProvider || 'openai';
  renderProviderOptions(defaultProvider);
};

const buildJobFromMetadata = (metadata) => {
  const provider = metadata.provider || defaultProvider;

  return {
    id: metadata.outputFolder,
    status: metadata.status,
    folderName: metadata.outputFolder,
    request: {
      characterName: metadata.characterName,
      description: metadata.description,
      style: metadata.style,
      notes: metadata.notes,
      outputDirName: metadata.outputFolder,
      assetTypes: [...ASSET_ORDER],
      provider,
      seed: metadata.seed,
    },
    files: metadata.files || [],
    metadata: {
      ...metadata,
      provider,
    },
  };
};

const findFileByAssetType = (job, assetType) => {
  return job?.files?.find((file) => file.assetType === assetType) || null;
};

const pickOutputPreview = (files) => {
  const preferred = ['base_fullbody', 'portrait', 'battler', 'battler_attack', 'faces'];

  for (const assetType of preferred) {
    const match = files.find((file) => file.assetType === assetType && file.status === 'generated');
    if (match) {
      return match;
    }
  }

  return files.find((file) => file.status === 'generated') || null;
};

const clearCurrentJob = () => {
  currentJob = null;

  if (previewPanel) {
    previewPanel.classList.add('hidden');
  }

  if (actionsPanel) {
    actionsPanel.classList.add('hidden');
  }

  if (previewTitle) {
    previewTitle.textContent = 'Aktuelles Set';
  }

  if (jobMeta) {
    jobMeta.innerHTML = '';
  }

  if (assetList) {
    assetList.innerHTML = '';
  }

  if (assetActions) {
    assetActions.innerHTML = '';
  }

  if (result) {
    result.textContent = '';
  }

  renderOutputsList(currentOutputs);
};

const syncFormFromJob = (job) => {
  if (!form || !job) {
    return;
  }

  form.characterName.value = job.request.characterName || '';
  form.description.value = job.request.description || '';
  form.style.value = job.request.style || '';
  form.notes.value = job.request.notes || '';
  form.outputDirName.value = '';
  form.seed.value = job.request.seed ?? '';

  if (providerSelect) {
    renderProviderOptions(job.request.provider || job.metadata?.provider || defaultProvider);
  }
};

const renderOutputsList = (items) => {
  if (!outputsList) {
    return;
  }

  if (!items.length) {
    outputsList.innerHTML = '<p class="empty-state">Noch keine gespeicherten Outputs gefunden.</p>';
    return;
  }

  outputsList.innerHTML = items
    .map((item) => {
      const preview = pickOutputPreview(item.files || []);
      const isActive = currentJob?.folderName === item.folderName;
      const previewMarkup = preview
        ? `<img src="${escapeHtml(preview.url)}" alt="${escapeHtml(item.characterName)} Vorschau" loading="lazy" />`
        : '<div class="output-thumb placeholder">Keine Vorschau</div>';

      return `
        <article class="output-card ${isActive ? 'active' : ''}">
          <button class="output-open-button" type="button" data-folder-name="${escapeHtml(item.folderName)}">
            <div class="output-thumb-wrap">${previewMarkup}</div>
            <div class="output-copy">
              <strong>${escapeHtml(item.characterName)}</strong>
              <span>${escapeHtml(item.folderName)}</span>
              <span>Status: ${escapeHtml(item.status)}</span>
              <span>Erstellt: ${escapeHtml(formatDate(item.generatedAt))}</span>
            </div>
          </button>
          <button class="output-delete-button" type="button" data-delete-folder="${escapeHtml(item.folderName)}">Loeschen</button>
        </article>
      `;
    })
    .join('');

  outputsList.querySelectorAll('[data-folder-name]').forEach((button) => {
    button.addEventListener('click', () => {
      const folderName = button.getAttribute('data-folder-name');
      if (folderName) {
        void loadOutput(folderName);
      }
    });
  });

  outputsList.querySelectorAll('[data-delete-folder]').forEach((button) => {
    button.addEventListener('click', () => {
      const folderName = button.getAttribute('data-delete-folder');
      if (folderName) {
        void deleteOutput(folderName);
      }
    });
  });
};

const renderAssetActions = (job) => {
  if (!actionsPanel || !assetActions) {
    return;
  }

  if (!job) {
    actionsPanel.classList.add('hidden');
    assetActions.innerHTML = '';
    return;
  }

  actionsPanel.classList.remove('hidden');
  assetActions.innerHTML = ASSET_ORDER.map((assetType) => {
    return `
      <button class="action-button" type="button" data-asset-type="${escapeHtml(assetType)}">
        <span>${escapeHtml(assetLabel(assetType))}</span>
        <small>Regenerate</small>
      </button>
    `;
  }).join('');

  assetActions.querySelectorAll('[data-asset-type]').forEach((button) => {
    button.addEventListener('click', () => {
      const assetType = button.getAttribute('data-asset-type');
      if (assetType) {
        void regenerateAsset(assetType);
      }
    });
  });
};

const renderJob = (job) => {
  if (!previewPanel || !jobMeta || !assetList || !previewTitle) {
    return;
  }

  currentJob = job;
  syncFormFromJob(job);
  previewPanel.classList.remove('hidden');
  previewTitle.textContent = `${job.request.characterName} | ${job.folderName}`;

  const provider = getProviderById(job.request.provider || job.metadata?.provider || defaultProvider);
  const providerLabel = provider?.label || (job.request.provider || job.metadata?.provider || defaultProvider);

  jobMeta.innerHTML = `
    <div class="meta-card"><span>Ordner</span><strong>${escapeHtml(job.folderName)}</strong></div>
    <div class="meta-card"><span>Status</span><strong>${escapeHtml(job.status)}</strong></div>
    <div class="meta-card"><span>Provider</span><strong>${escapeHtml(providerLabel)}</strong></div>
    <div class="meta-card"><span>Modell</span><strong>${escapeHtml(job.metadata.model || 'unbekannt')}</strong></div>
    <div class="meta-card"><span>Erstellt</span><strong>${escapeHtml(formatDate(job.metadata.generatedAt))}</strong></div>
    <div class="meta-card"><span>Aktualisiert</span><strong>${escapeHtml(formatDate(job.metadata.updatedAt))}</strong></div>
    <div class="meta-card meta-wide"><span>Beschreibung</span><strong>${escapeHtml(job.request.description)}</strong></div>
    ${job.request.style ? `<div class="meta-card meta-wide"><span>Stil</span><strong>${escapeHtml(job.request.style)}</strong></div>` : ''}
    ${job.request.notes ? `<div class="meta-card meta-wide"><span>Zusatzhinweise</span><strong>${escapeHtml(job.request.notes)}</strong></div>` : ''}
  `;

  assetList.innerHTML = ASSET_ORDER.map((assetType) => {
    const file = findFileByAssetType(job, assetType);
    const promptMarkup = file?.prompt
      ? `<details class="prompt-details"><summary>Verwendeter Prompt</summary><p>${escapeHtml(file.prompt)}</p></details>`
      : '';
    const previewMarkup = file?.status === 'generated'
      ? `<img class="asset-image" src="${escapeHtml(file.url)}" alt="${escapeHtml(assetLabel(assetType))} Vorschau" loading="lazy" />`
      : `<div class="asset-placeholder">${file?.error ? escapeHtml(file.error) : 'Noch nicht vorhanden'}</div>`;

    return `
      <article class="asset-card ${file?.status === 'failed' ? 'is-error' : ''}">
        <div class="asset-card-head">
          <div>
            <p class="asset-kicker">${escapeHtml(assetType)}</p>
            <h3>${escapeHtml(assetLabel(assetType))}</h3>
          </div>
          <button class="ghost-button compact-button" type="button" data-regenerate-asset="${escapeHtml(assetType)}">Neu generieren</button>
        </div>
        <div class="asset-meta">
          <span>Datei: ${escapeHtml(file?.filename || `${assetType}.png`)}</span>
          <span>Format: ${escapeHtml(formatDimensions(file))}</span>
          <span>Status: ${escapeHtml(file?.status || 'missing')}</span>
        </div>
        ${previewMarkup}
        ${promptMarkup}
      </article>
    `;
  }).join('');

  assetList.querySelectorAll('[data-regenerate-asset]').forEach((button) => {
    button.addEventListener('click', () => {
      const assetType = button.getAttribute('data-regenerate-asset');
      if (assetType) {
        void regenerateAsset(assetType);
      }
    });
  });

  renderAssetActions(job);
  renderOutputsList(currentOutputs);
  if (result) {
    result.textContent = JSON.stringify(job, null, 2);
  }
};

const collectFormPayload = () => {
  const formData = new FormData(form);
  const characterName = String(formData.get('characterName') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const style = String(formData.get('style') || '').trim();
  const notes = String(formData.get('notes') || '').trim();
  const outputDirName = String(formData.get('outputDirName') || '').trim();
  const provider = String(formData.get('provider') || defaultProvider).trim() || defaultProvider;
  const seedText = String(formData.get('seed') || '').trim();

  return {
    characterName,
    description,
    style: style || undefined,
    notes: notes || undefined,
    outputDirName: outputDirName || undefined,
    provider,
    seed: seedText ? Number(seedText) : undefined,
  };
};

const refreshOutputs = async () => {
  currentOutputs = await asJson(await fetch('/api/list-outputs'));
  renderOutputsList(currentOutputs);
};

const loadOutput = async (folderName) => {
  setStatus(`Lade Output ${folderName} ...`, 'info', 'Metadata und Dateien werden aus dem lokalen Output-Ordner gelesen.');

  const metadata = await asJson(await fetch(`/api/output/${encodeURIComponent(folderName)}/metadata`));
  renderJob(buildJobFromMetadata(metadata));
  setStatus(`Output ${folderName} geladen.`, 'success', 'Einzelne Assets konnen direkt neu generiert werden.');
};

const deleteOutput = async (folderName) => {
  const confirmed = window.confirm(`Output ${folderName} wirklich loeschen? Dieser Ordner wird lokal entfernt.`);
  if (!confirmed) {
    return;
  }

  if (generateBtn) {
    generateBtn.disabled = true;
  }

  setStatus(`Loesche Output ${folderName} ...`, 'info', 'Der lokale Output-Ordner und seine Dateien werden entfernt.');

  try {
    await asJson(
      await fetch(`/api/output/${encodeURIComponent(folderName)}`, {
        method: 'DELETE',
      }),
    );

    const deletedActiveOutput = currentJob?.folderName === folderName;
    await refreshOutputs();

    if (deletedActiveOutput) {
      if (currentOutputs.length > 0) {
        await loadOutput(currentOutputs[0].folderName);
      } else {
        clearCurrentJob();
      }
    }

    setStatus(`Output ${folderName} geloescht.`, 'success', 'Die Output-Liste wurde aktualisiert.');
  } catch (error) {
    setStatus(`Loeschen fehlgeschlagen: ${error.message}`, 'error', 'Der Output-Ordner wurde nicht entfernt.');
  } finally {
    if (generateBtn) {
      generateBtn.disabled = false;
    }
  }
};

const regenerateAsset = async (assetType) => {
  if (!currentJob) {
    return;
  }

  const currentProvider = currentJob.request.provider || currentJob.metadata?.provider || defaultProvider;
  const providerInfo = getProviderById(currentProvider);
  if (!providerInfo?.configured) {
    setStatus(
      `Provider ${currentProvider} ist nicht konfiguriert.`,
      'error',
      `Erwartet: ${providerInfo?.keyEnvVar || 'API-Key in .env'}.`,
    );
    return;
  }

  const promptOverride = window.prompt(`Optionaler Zusatzhinweis fur ${assetLabel(assetType)}:`, '');

  if (promptOverride === null) {
    return;
  }

  if (generateBtn) {
    generateBtn.disabled = true;
  }

  setStatus(
    `${assetLabel(assetType)} wird neu generiert ...`,
    'info',
    `Output-Ordner: ${currentJob.folderName} | Provider: ${providerInfo.label}`,
  );

  try {
    const payload = {
      folderName: currentJob.folderName,
      assetType,
      promptOverride: promptOverride.trim() || undefined,
      characterName: currentJob.request.characterName,
      description: currentJob.request.description,
      style: currentJob.request.style,
      notes: currentJob.request.notes,
      provider: currentProvider,
      seed: currentJob.request.seed,
    };

    const updatedJob = await asJson(
      await fetch('/api/regenerate-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );

    renderJob(updatedJob);
    await refreshOutputs();
    setStatus(`${assetLabel(assetType)} wurde neu generiert.`, 'success', 'Metadata.json wurde aktualisiert.');
  } catch (error) {
    setStatus(
      `Regeneration fehlgeschlagen: ${error.message}`,
      'error',
      'Das bestehende Output-Set wurde nicht uberschrieben.',
    );
  } finally {
    if (generateBtn) {
      generateBtn.disabled = false;
    }
  }
};

if (providerSelect) {
  providerSelect.addEventListener('change', () => {
    updateProviderHint();
  });
}

if (refreshOutputsBtn) {
  refreshOutputsBtn.addEventListener('click', () => {
    void refreshOutputs()
      .then(() => {
        setStatus('Output-Liste aktualisiert.', 'success', 'Alle gespeicherten Generationen wurden neu eingelesen.');
      })
      .catch((error) => {
        setStatus(`Output-Liste konnte nicht geladen werden: ${error.message}`, 'error');
      });
  });
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = collectFormPayload();
    const providerInfo = getProviderById(payload.provider);

    if (!payload.characterName || !payload.description) {
      setStatus('Bitte Charaktername und Hauptbeschreibung ausfullen.', 'error');
      return;
    }

    if (!providerInfo?.configured) {
      setStatus(
        `Provider ${payload.provider} ist nicht konfiguriert.`,
        'error',
        `Erwartet: ${providerInfo?.keyEnvVar || 'API-Key in .env'}.`,
      );
      return;
    }

    if (generateBtn) {
      generateBtn.disabled = true;
    }

    setStatus(
      'Komplettes Set wird generiert ...',
      'info',
      `Provider: ${providerInfo.label} | Der Server erzeugt jetzt vier 9-Frame-Walk-Loops, SV Battler Idle, SV Battler Attack, Faces, Portrait und Base Fullbody.`,
    );

    try {
      const job = await asJson(
        await fetch('/api/generate-set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      );

      renderJob(job);
      await refreshOutputs();
      setStatus('Komplettes Set gespeichert.', 'success', `Output-Ordner: ${job.folderName}`);
    } catch (error) {
      setStatus(
        `Generierung fehlgeschlagen: ${error.message}`,
        'error',
        'Bitte Eingaben oder Server-Konfiguration prufen.',
      );
    } finally {
      if (generateBtn) {
        generateBtn.disabled = false;
      }
    }
  });
}

void loadProviders()
  .then(() => refreshOutputs())
  .then(async () => {
    if (currentOutputs.length > 0) {
      await loadOutput(currentOutputs[0].folderName);
      return;
    }

    clearCurrentJob();
  })
  .catch((error) => {
    setStatus(`Initiale Daten konnten nicht geladen werden: ${error.message}`, 'error');
  });
