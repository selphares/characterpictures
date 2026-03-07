# RPG Maker MZ Character Asset Generator

Lokale Web-App mit Node.js und TypeScript im Backend sowie einem statischen Frontend fur die serverseitige Generierung eines kompletten RPG Maker MZ Charakter-Asset-Sets.

Unterstuetzte Provider-Modi:
- OpenAI `gpt-image-1.5`
- Google Gemini Image via Gemini API (`GOOGLE_IMAGE_MODEL`, standardmassig `gemini-3.1-flash-image-preview`)
- ChatGPT Prompt-Paket mit manuellem Bild-Import
- Gemini Prompt-Paket mit manuellem Bild-Import

## Voraussetzungen

- Node.js 20+
- npm
- fur API-Modi mindestens ein API Key in `.env`

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
- Im UI kann der Provider pro Generierung uber ein Dropdown ausgewahlt werden.
- Die Prompt-Paket-Modi fur ChatGPT und Gemini brauchen keinen API-Key.

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
  walk_down.png|jpg|webp
  walk_left.png|jpg|webp
  walk_right.png|jpg|webp
  walk_up.png|jpg|webp
  battler.png|jpg|webp
  battler_attack.png|jpg|webp
  faces.png|jpg|webp
  portrait.png|jpg|webp
  base_fullbody.png|jpg|webp
  metadata.json
```

`metadata.json` enthalt Charakterdaten, Provider, Modell, Zeitstempel, Status, Dateiliste und die tatsachlich verwendeten Prompt-Varianten pro Asset.

## API-Endpunkte

- `GET /api/providers`
- `POST /api/generate-set`
- `POST /api/regenerate-asset`
- `POST /api/upload-asset`
- `GET /api/list-outputs`
- `GET /api/output/:folder/:file`
- `GET /api/output/:folder/metadata`
- `GET /api/health`

## Typische Nutzung

API-Modus:
1. Charaktername, Hauptbeschreibung, Stil und Zusatzhinweise im Formular eingeben.
2. OpenAI oder Google Gemini API im Provider-Dropdown auswahlen.
3. `Generate Full Set` auslosen.
4. Das erzeugte Set im Preview-Panel pruefen.
5. Einzelne Assets uber `Neu generieren` gezielt erneut erzeugen.

Prompt-Paket-Modus:
1. Charaktername, Hauptbeschreibung, Stil und Zusatzhinweise eingeben.
2. `ChatGPT Prompt Paket` oder `Gemini Prompt Paket` auswahlen.
3. `Prompt-Paket erstellen` auslosen.
4. Pro Asset den gespeicherten Prompt kopieren.
5. Das Bild extern in ChatGPT oder Gemini erzeugen.
6. Das Ergebnis pro Asset uber `Bild hochladen` wieder in dasselbe Set importieren.
7. Falls du spaeter bessere Referenzen hast, pro Asset `Prompt aktualisieren` nutzen.

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
- Die API-Generierung lauft in einer festen Reihenfolge mit einem internen `consistency_anchor.png` als kanonischem Turnaround-Modellblatt, damit nachfolgende Assets dieselbe Figur konsequent uber Referenzbilder nachziehen.
- Re-Generate einzelner Assets verwendet den internen Consistency-Anchor und passende bereits vorhandene Set-Bilder wieder als Referenzen, um Gesicht, Outfit und Proportionen enger zusammenzuhalten.
- Im Prompt-Paket-Modus werden keine Bild-API-Kosten verursacht. Die App speichert nur die finalen Prompts und wartet auf manuell importierte Bilder.
- Hochgeladene externe Bilder werden aktuell als `png`, `jpg` oder `webp` gespeichert.
- OpenAI bietet die praezisere Groessen- und Transparenzsteuerung. Google Gemini wird uber die offizielle Gemini Image Generation API angebunden und setzt Formatwunsche primar uber Prompt-Instruktionen plus Referenzbilder um.
- Wenn die Bild-API einzelne Parameter oder Referenz-Edits nicht akzeptiert, verwendet der OpenAI-Pfad kompatible Fallbacks.

## Quellen

- [Google Gemini API Image Generation](https://ai.google.dev/gemini-api/docs/image-generation?hl=de#best-practices)
- [Google Gen AI SDK](https://ai.google.dev/gemini-api/docs/sdks)
