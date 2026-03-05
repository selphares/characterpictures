# characterpictures

## Environment variables

Create a `.env` file (server runtime only) based on `.env.example` and provide your OpenAI key:

```bash
cp .env.example .env
```

```env
OPENAI_API_KEY=your_openai_api_key_here
```

Load this key **only on the server** via `process.env.OPENAI_API_KEY`.

## OpenAI image generation architecture

OpenAI image generation must be implemented exclusively in `src/lib/image-service.ts`.

- Frontend code must never call the OpenAI API directly.
- Frontend should call your own backend endpoint/action.
- Backend delegates image generation to `generateImage(...)` in `src/lib/image-service.ts`.

## Error handling and secret safety

Use centralized error handling from `src/lib/image-service.ts`:

- `sanitizeErrorMessage(...)` removes potential secrets/tokens from error strings.
- `toSafeError(...)` normalizes unknown exceptions into safe `AppError` instances.
- `formatErrorForClient(...)` ensures client-facing responses never include sensitive config values, tokens, or stack details.

This keeps operational details private while still providing stable error codes for UI/API clients.
