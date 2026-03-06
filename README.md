# characterpictures

Basis-Setup für einen TypeScript-Server mit statischem Frontend.

## Voraussetzungen

- Node.js 20+
- npm
- OpenAI API Key (`OPENAI_API_KEY`)

## Schnellstart

```bash
npm install
npm run dev
```

Danach ist die App unter `http://localhost:3000` erreichbar.

## OpenAI-Key lokal hinterlegen (ohne jedes Mal `export`)

Der Server lädt automatisch eine lokale `.env`-Datei beim Start.

1. Datei anlegen:
   ```bash
   cp .env.example .env
   ```
2. In `.env` deinen echten Key eintragen:
   ```env
   OPENAI_API_KEY=<dein-openai-key>
   ```
3. Server normal starten:
   ```bash
   npm run dev
   ```

> Die `.env` ist in `.gitignore` eingetragen und wird nicht ins Repo committed.

## Windows-Start via BAT + PowerShell

Wenn du alles bequem per Doppelklick starten willst:

- `start-dev.bat` startet `scripts/start-dev.ps1`.
- Das PowerShell-Skript versucht automatisch:
  - `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`
  - Falls das wegen Sicherheitsrichtlinien fehlschlägt, läuft der Start trotzdem weiter.
- Falls `.env` fehlt, wird sie aus `.env.example` erstellt.
- Falls `node_modules` fehlt, wird `npm install` ausgeführt.
- Danach startet `npm run dev`.

## OpenAI-Bilderzeugung

Die Bildgenerierung läuft über den Endpoint `POST /api/assets/generate` und verwendet das Modell `gpt-image-1`.
Der API-Key wird über `OPENAI_API_KEY` eingelesen (z. B. aus `.env`).

## Struktur

- `src/` – Server und Backend-Logik
- `src/lib/` – Services/Utilities
- `client/` – Statisches Frontend
- `outputs/` – Ausgabeordner für generierte Dateien
- `scripts/start-dev.ps1` – Windows-Helferskript
- `start-dev.bat` – Starter für PowerShell-Skript
