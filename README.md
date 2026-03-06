# characterpictures

Basis-Setup für einen TypeScript-Server mit statischem Frontend.

## Voraussetzungen

- Node.js 20+
- npm
- OpenAI API Key (`OPENAI_API_KEY`)

## Start

```bash
npm install
export OPENAI_API_KEY="<dein-openai-key>"
npm run dev
```

Danach ist die App unter `http://localhost:3000` erreichbar.

## OpenAI-Bilderzeugung

Die Bildgenerierung läuft über den Endpoint `POST /api/assets/generate` und verwendet das Modell `gpt-image-1`.
Der API-Key wird ausschließlich über die Umgebungsvariable `OPENAI_API_KEY` gelesen.

Optional kannst du auch eine `.env` verwenden (z. B. mit deinem Prozessmanager), wichtig ist nur, dass beim Starten des Servers `OPENAI_API_KEY` gesetzt ist.

## Struktur

- `src/` – Server und Backend-Logik
- `src/lib/` – Services/Utilities
- `client/` – Statisches Frontend
- `outputs/` – Ausgabeordner für generierte Dateien
