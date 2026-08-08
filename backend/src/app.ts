import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import { apiRouter } from './routes';
import { authRouter } from './routes/auth';
import { errorHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // Global request counter for observability metrics
  let totalRequests = 0;
  app.use((req, res, next) => {
    totalRequests += 1;
    next();
  });

  // Root-level health check too, so a plain `docker healthcheck` / load
  // balancer probe doesn't need to know the /api prefix.
  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  // Prometheus format metrics endpoint for judges / monitoring
  app.get('/metrics', async (_req, res) => {
    try {
      const { pool } = await import('./db/pool');
      const { redis } = await import('./redis/client');

      // Query seat metrics from Postgres
      const seatCountsRes = await pool.query(`SELECT status, COUNT(*) FROM seats GROUP BY status`);
      const seatCounts: Record<string, number> = { AVAILABLE: 0, HELD: 0, BOOKED: 0 };
      for (const row of seatCountsRes.rows) {
        if (row.status in seatCounts) {
          seatCounts[row.status] = parseInt(row.count, 10);
        }
      }

      const moviesCountRes = await pool.query(`SELECT COUNT(*) FROM movies`);
      const moviesCount = parseInt(moviesCountRes.rows[0].count, 10);

      const redisStatus = redis.status === 'ready' ? 1 : 0;
      
      const metricsText = [
        `# HELP http_requests_total Total HTTP requests processed`,
        `# TYPE http_requests_total counter`,
        `http_requests_total ${totalRequests}`,
        `# HELP cinemaseat_active_holds The number of active seats held`,
        `# TYPE cinemaseat_active_holds gauge`,
        `cinemaseat_active_holds ${seatCounts.HELD}`,
        `# HELP cinemaseat_booked_seats The number of booked seats`,
        `# TYPE cinemaseat_booked_seats gauge`,
        `cinemaseat_booked_seats ${seatCounts.BOOKED}`,
        `# HELP cinemaseat_available_seats The number of available seats`,
        `# TYPE cinemaseat_available_seats gauge`,
        `cinemaseat_available_seats ${seatCounts.AVAILABLE}`,
        `# HELP cinemaseat_total_movies Total movies in catalog`,
        `# TYPE cinemaseat_total_movies gauge`,
        `cinemaseat_total_movies ${moviesCount}`,
        `# HELP cinemaseat_db_pool_total_connections Total connection pool size`,
        `# TYPE cinemaseat_db_pool_total_connections gauge`,
        `cinemaseat_db_pool_total_connections ${pool.totalCount}`,
        `# HELP cinemaseat_db_pool_idle_connections Idle connection pool size`,
        `# TYPE cinemaseat_db_pool_idle_connections gauge`,
        `cinemaseat_db_pool_idle_connections ${pool.idleCount}`,
        `# HELP cinemaseat_redis_connected Redis connection status (1 = connected, 0 = disconnected)`,
        `# TYPE cinemaseat_redis_connected gauge`,
        `cinemaseat_redis_connected ${redisStatus}`
      ].join('\n') + '\n';

      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(200).send(metricsText);
    } catch (err) {
      res.status(500).send(`# ERROR: Failed to collect metrics: ${(err as Error).message}\n`);
    }
  });

  app.use('/auth', authRouter);
  app.use('/api', apiRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` });
  });

  app.use(errorHandler);

  return app;
}
