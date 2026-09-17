import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { ApiException } from './api-exception';

/**
 * The message for an error the framework raised rather than our code. Fixed
 * strings, not the framework's text: that text is a parser's or router's
 * internals ("Unexpected end of JSON input", "Cannot GET /api/x").
 */
function frameworkMessage(status: number, detail: string): string {
  if (status === 400) return /JSON/.test(detail) ? 'Invalid JSON body' : 'Invalid request';
  if (status === 404) return 'Not found';
  if (status === 413) return 'Request body too large';
  if (status === 415) return 'Unsupported content type';
  return 'Request failed';
}

/**
 * Every error leaves the API as `{ error: string, ...extra }`.
 *
 *   ApiException          its own body, unchanged
 *   other HttpException   Nest's own — unknown route, malformed JSON — with a
 *                         fixed message
 *   body-parser error     413 too large etc.; these never become HttpExceptions
 *   anything else         500 `{ error: 'Something went wrong' }`, logged with
 *                         the request id. The real message stays in the log:
 *                         a Prisma or Paystack error string is not for clients.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request & { requestId?: string }>();

    if (exception instanceof ApiException) {
      for (const [name, value] of Object.entries(exception.headers)) {
        res.setHeader(name, value);
      }
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      res.status(status).json({ error: frameworkMessage(status, exception.message) });
      return;
    }

    // body-parser raises `http-errors` objects: a 4xx `status` with
    // `expose: true`. Only those are the client's fault; anything else is ours.
    const httpError = exception as { status?: unknown; expose?: unknown; message?: unknown };
    if (
      httpError?.expose === true &&
      typeof httpError.status === 'number' &&
      httpError.status >= 400 &&
      httpError.status < 500
    ) {
      res
        .status(httpError.status)
        .json({ error: frameworkMessage(httpError.status, String(httpError.message ?? '')) });
      return;
    }

    // One argument: Nest's `error(message, stack)` would take a second one as a
    // stack trace.
    this.logger.error({
      msg: 'Unhandled error',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      err:
        exception instanceof Error
          ? { name: exception.name, message: exception.message, stack: exception.stack }
          : String(exception),
    });
    res.status(500).json({ error: 'Something went wrong' });
  }
}
