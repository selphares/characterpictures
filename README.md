# Character Pictures API

## Projektbeschreibung und Ziel
Dieses Projekt erzeugt konsistente Character-Asset-Sets (z. B. Portrait, Ganzkörper, Varianten) über eine API.
Ziel ist ein reproduzierbarer Workflow für:

- **Full-Set-Generierung** eines kompletten Asset-Pakets je Charakter.
- **Re-Generate** einzelner Assets, ohne das gesamte Set neu zu erstellen.
- Nachvollziehbare Ausgabe in strukturierten Output-Ordnern inklusive `metadata.json`.

## Voraussetzungen
Stelle sicher, dass folgende Software installiert ist:

- **Node.js** (empfohlen: aktuelle LTS-Version)
- **npm** (wird mit Node.js installiert)
- Optional: Zugriff auf den konfigurierten Bild-/LLM-Provider (je nach `.env`)

## Installation
Abhängigkeiten installieren:

```bash
npm install
```

## `.env`-Setup
Beispieldatei kopieren und Werte eintragen:

```bash
cp .env.example .env
```

Typische Variablen (projektspezifisch anpassen):

- `PORT` – Server-Port
- `NODE_ENV` – Laufzeitmodus
- `API_KEY` / Provider-Credentials
- `OUTPUT_DIR` – Basisordner für generierte Ergebnisse

## Start
Entwicklungsserver starten:

```bash
npm run dev
```

## Ordnerstruktur
Beispielhafte Struktur:

```text
.
├── src/
│   ├── api/                 # Routen/Controller
│   ├── services/            # Business-Logik (Generierung, Retry, etc.)
│   ├── prompts/             # Prompt-Templates / Presets
│   ├── utils/               # Hilfsfunktionen
│   └── index.(js|ts)        # App-Entry
├── output/                  # Generierte Assets
│   └── <character-id>/
│       ├── metadata.json
│       ├── full-set/
│       └── regenerated/
├── .env.example
├── package.json
└── README.md
```

## API-Endpunkte und Beispielpayloads
> Die folgenden Endpunkte sind als Referenz für die Character-Generation gedacht. Falls eure Implementierung abweicht, Endpunkte/Namen entsprechend angleichen.

### 1) Health-Check

- **GET** `/health`

Beispielantwort:

```json
{
  "status": "ok"
}
```

### 2) Full-Set generieren

- **POST** `/api/generate/full-set`

Beispiel-Request:

```json
{
  "characterId": "char_001",
  "name": "Ayla",
  "style": "semi-realistic",
  "seed": 12345,
  "assets": ["portrait", "full_body", "icon"],
  "constraints": {
    "palette": "warm",
    "background": "transparent"
  }
}
```

Beispiel-Response:

```json
{
  "jobId": "job_abc123",
  "characterId": "char_001",
  "status": "queued"
}
```

### 3) Einzelnes Asset neu generieren

- **POST** `/api/generate/regenerate-asset`

Beispiel-Request:

```json
{
  "characterId": "char_001",
  "assetType": "portrait",
  "reason": "fix lighting",
  "seed": 67890,
  "preserve": ["face", "palette"]
}
```

Beispiel-Response:

```json
{
  "jobId": "job_def456",
  "characterId": "char_001",
  "assetType": "portrait",
  "status": "queued"
}
```

### 4) Job-Status abfragen

- **GET** `/api/jobs/:jobId`

Beispielantwort:

```json
{
  "jobId": "job_abc123",
  "status": "completed",
  "outputPath": "output/char_001/full-set"
}
```

## Ablauf für Full-Set-Generierung
1. Client sendet Request an `POST /api/generate/full-set`.
2. Server validiert Payload (Pflichtfelder, erlaubte Asset-Typen, Limits).
3. Job wird erstellt und in Queue/Worker-Pipeline übernommen.
4. Für jedes angeforderte Asset wird ein Generierungsschritt ausgeführt.
5. Ergebnisse werden unter `output/<character-id>/full-set/` gespeichert.
6. `metadata.json` wird mit Prompt-/Seed-/Dateipfad-Informationen aktualisiert.
7. Job-Status wechselt auf `completed` (oder `failed` mit Fehlerdetails).

## Ablauf für Re-Generate einzelner Assets
1. Client sendet Request an `POST /api/generate/regenerate-asset`.
2. Server lädt bestehende Charakter-Metadaten.
3. Ziel-Asset wird mit neuen Parametern (z. B. neuer Seed) erneut erzeugt.
4. Altes Asset bleibt optional erhalten (Versionierung empfohlen).
5. Neues Ergebnis wird unter `output/<character-id>/regenerated/` abgelegt.
6. `metadata.json` erhält einen neuen Eintrag mit Historie und Zeitstempel.

## Hinweise zu Output-Ordnern und `metadata.json`
Empfohlene Konvention:

- Pro Charakter ein eigener Ordner: `output/<character-id>/`
- Klare Trennung von Erstgenerierung und Re-Generierung:
  - `full-set/`
  - `regenerated/`
- Dateinamen mit Asset-Typ + Version + Timestamp, z. B.:
  - `portrait_v1_2026-01-10T10-15-30Z.png`

Beispiel `metadata.json`:

```json
{
  "characterId": "char_001",
  "name": "Ayla",
  "createdAt": "2026-01-10T10:15:30.000Z",
  "updatedAt": "2026-01-10T10:25:10.000Z",
  "assets": [
    {
      "assetType": "portrait",
      "version": 1,
      "path": "output/char_001/full-set/portrait_v1.png",
      "seed": 12345,
      "promptHash": "a1b2c3",
      "status": "completed"
    },
    {
      "assetType": "portrait",
      "version": 2,
      "path": "output/char_001/regenerated/portrait_v2.png",
      "seed": 67890,
      "promptHash": "d4e5f6",
      "status": "completed",
      "regeneratedFrom": 1,
      "reason": "fix lighting"
    }
  ]
}
```

Damit sind Ergebnisse reproduzierbar, Änderungen nachvollziehbar und Downstream-Prozesse (z. B. Publishing, QA, Game-Import) einfacher automatisierbar.
