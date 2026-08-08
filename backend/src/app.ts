import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import { apiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // Root-level health check too, so a plain `docker healthcheck` / load
  // balancer probe doesn't need to know the /api prefix.
  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.use('/api', apiRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` });
  });

  app.use(errorHandler);

  return app;
}
