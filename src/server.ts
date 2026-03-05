import express, { NextFunction, Request, Response } from 'express';
import assetRoutes from './routes/assets';

type ApiError = Error & {
  statusCode?: number;
  code?: string;
  details?: unknown;
};

const app = express();

app.use(express.json());
app.use('/api/assets', assetRoutes);

app.use((error: ApiError, _req: Request, res: Response, _next: NextFunction) => {
  const status = error.statusCode ?? 500;

  if (status >= 500) {
    console.error('[api-error]', {
      message: error.message,
      stack: error.stack,
      details: error.details,
    });
  }

  res.status(status).json({
    error: {
      message: error.message || 'Internal Server Error',
      code: error.code ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST'),
      details: error.details,
    },
  });
});

export default app;
