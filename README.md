# RPG Maker MZ Character Asset Generator

Lokale Web-App mit Node.js und TypeScript im Backend sowie einem statischen Frontend fur die serverseitige Generierung eines kompletten RPG Maker MZ Charakter-Asset-Sets.

Unterstuetzte Bildprovider:
- OpenAI `gpt-image-1.5`
- Google Gemini Image via Gemini API (`GOOGLE_IMAGE_MODEL`, standardmassig `gemini-3.1-flash-image-preview`)

## Voraussetzungen

- Node.js 20+
- npm
- mindestens ein API Key in `.env`

## Installation

```bash
npm install
cp .env.example .env
npm run dev
```

Die App lauft danach unter `http://localhost:3000`.

## .env Setup

```env
OPENAI_API_KEY=<dein-openai-api-key>
OPENAI_IMAGE_MODEL=gpt-image-1.5

GOOGLE_API_KEY=<dein-google-api-key>
GOOGLE_IMAGE_MODEL=gemini-3.1-flash-image-preview
```

Hinweise:
- Alternativ zu `GOOGLE_API_KEY` akzeptiert der Server auch `GEMINI_API_KEY`.
- Beide Keys bleiben strikt serverseitig und werden nie ins Frontend geschrieben.
- Im UI kann der Bildprovider pro Generierung uber ein Dropdown ausgewahlt werden.

## Startbefehle

```bash
npm run dev
npm run build
npm run start
```

## Generierte Asset-Typen

- `walk_down`
- `walk_left`
- `walk_right`
- `walk_up`
- `battler`
- `battler_attack`
- `faces`
- `portrait`
- `base_fullbody`

## Output-Struktur

Jede Generierung landet in einem eigenen Ordner unter `outputs/`:

```text
outputs/<character-name>-<timestamp>/
  walk_down.png
  walk_left.png
  walk_right.png
  walk_up.png
  battler.png
  battler_attack.png
  faces.png
  portrait.png
  base_fullbody.png
  metadata.json
```

`metadata.json` enthalt Charakterdaten, Provider, Modell, Zeitstempel, Status, Dateiliste und die tatsachlich verwendeten Prompt-Varianten pro Asset.

## API-Endpunkte

- `GET /api/providers`
- `POST /api/generate-set`
- `POST /api/regenerate-asset`
- `GET /api/list-outputs`
- `GET /api/output/:folder/:file`
- `GET /api/output/:folder/metadata`
- `GET /api/health`

## Typische Nutzung

1. Charaktername, Hauptbeschreibung, Stil und Zusatzhinweise im Formular eingeben.
2. Gewunschten Bildprovider im Dropdown auswahlen.
3. `Generate Full Set` auslosen.
4. Das erzeugte Set im Preview-Panel pruefen.
5. Einzelne Assets uber `Neu generieren` oder das Asset-Actions-Panel gezielt erneut erzeugen.
6. Fruhere Generierungen uber die Output-Liste wieder laden.

## Ordnerstruktur

```text
client/
  index.html
  styles.css
  app.js
src/
  server.ts
  routes/
  lib/
outputs/
```

## Hinweise

- Die Walking-Assets werden auf 9-Frame-Loops in 3x3-Layouts ausgerichtet.
- `battler.png` ist als 9-Frame-SV-Idle-Sheet gedacht, `battler_attack.png` als 9-Frame-SV-Attack-Sheet.
- Die Generierung lauft in einer festen Reihenfolge mit einem internen `consistency_anchor.png` als kanonischem Turnaround-Modellblatt, damit nachfolgende Assets dieselbe Figur konsequent uber Referenzbilder nachziehen.
- Re-Generate einzelner Assets verwendet den internen Consistency-Anchor und passende bereits vorhandene Set-Bilder wieder als Referenzen, um Gesicht, Outfit und Proportionen enger zusammenzuhalten.
- OpenAI bietet die praezisere Groessen- und Transparenzsteuerung. Google Gemini wird uber die offizielle Gemini Image Generation API angebunden und setzt Formatwunsche primar uber Prompt-Instruktionen plus Referenzbilder um.
- Wenn die Bild-API einzelne Parameter oder Referenz-Edits nicht akzeptiert, verwendet der OpenAI-Pfad kompatible Fallbacks.

## Quellen

- [Google Gemini API Image Generation](https://ai.google.dev/gemini-api/docs/image-generation?hl=de#best-practices)
- [Google Gen AI SDK](https://ai.google.dev/gemini-api/docs/sdks)




