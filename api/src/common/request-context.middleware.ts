import { randomUUID } from 'node:crypto';

import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** Accept a caller's id only if it looks like one — it is echoed into logs. */
const SAFE_ID = /^[A-Za-z0-9_.:-]{8,128}$/;

/**
 * Request id + one structured access-log line per request.
 *
 * The id is taken from `x-request-id` when a proxy supplied a sane one (so a
 * Vercel → Render hop keeps one id end to end), generated otherwise, and
 * returned in the response header so a merchant's screenshot of an error can be
 * matched to a log line.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
    const incoming = req.header('x-request-id');
    const requestId =
      incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const started = process.hrtime.bigint();
    res.on('finish', () => {
      // The health check is polled constantly by Render; logging it would drown
      // everything else.
      if (req.originalUrl.startsWith('/api/health')) return;
      this.logger.log({
        requestId,
        method: req.method,
        // Query strings are dropped: they carry search terms and references.
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
      });
    });

    next();
  }
}
