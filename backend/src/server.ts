import { createApp } from './app';
import { env } from './config/env';
import { startHoldExpiryJob } from './jobs/holdExpiryJob';
import { logger } from './utils/logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`CinemaSeat backend listening`, { port: env.PORT, env: env.NODE_ENV });
  startHoldExpiryJob();
});

function shutdown(signal: string) {
  logger.info('shutting down', { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
