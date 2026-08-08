import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { processGatewayCallback } from '../services/paymentService';
import { logger } from '../utils/logger';

export const paymentsRouter = Router();

/**
 * The gateway calls this. Contract from the problem statement:
 *   "Always return 200, even for a duplicate. A non-200 tells the gateway
 *    that delivery failed, and it will retry forever."
 * So this handler catches its own errors and still answers 200 - the
 * idempotency logic inside processGatewayCallback is what actually
 * protects correctness, not the HTTP status code.
 */
paymentsRouter.post(
  '/callback',
  asyncHandler(async (req, res) => {
    try {
      const result = await processGatewayCallback(req.body);
      res.status(200).json({ received: true, duplicate: result.duplicate });
    } catch (err: any) {
      logger.error('callback processing failed', { message: err?.message, body: req.body });
      // Still 200: we do not want the gateway hammering us with infinite
      // retries for a payload we could not process. The event is logged
      // for manual reconciliation.
      res.status(200).json({ received: true, error: 'processing_error' });
    }
  })
);

paymentsRouter.post(
  '/otp-callback',
  asyncHandler(async (req, res) => {
    logger.info('OTP callback received from gateway', req.body);
    res.status(200).json({ received: true });
  })
);
