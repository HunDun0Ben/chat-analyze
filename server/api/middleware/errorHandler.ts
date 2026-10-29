import { ErrorRequestHandler } from 'express';

/**
 * Error carrying an explicit HTTP status. Thrown by query validation and any
 * route that needs to answer with a 4xx instead of a generic 500.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Single place that turns thrown errors into responses. Express 5 forwards
 * rejected promises from async handlers here automatically, so routes no
 * longer need their own try/catch blocks.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: error.message,
      ...(error.field ? { field: error.field } : {}),
    });
    return;
  }

  console.error('[API] Unhandled error:', error);
  res.status(500).json({ error: 'Internal Server Error' });
};
