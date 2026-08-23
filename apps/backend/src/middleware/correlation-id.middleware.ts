import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4, validate as validateUuid } from 'uuid';

export const CORRELATION_ID_HEADER = 'x-request-id';

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const reqIdHeader = req.headers[CORRELATION_ID_HEADER];

  let correlationId: string;
  if (typeof reqIdHeader === 'string' && validateUuid(reqIdHeader)) {
    correlationId = reqIdHeader;
  } else {
    correlationId = uuidv4();
  }

  // Set the correlation ID on the request object for easy access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any).correlationId = correlationId;

  // Set it on the response header so the client can track it
  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  next();
};
