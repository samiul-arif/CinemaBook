import { Router } from 'express';
import { healthRouter } from './health';
import { catalogRouter } from './catalog';
import { bookingsRouter } from './bookings';
import { paymentsRouter } from './payments';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/', catalogRouter);
apiRouter.use('/', bookingsRouter);
apiRouter.use('/payments', paymentsRouter);
