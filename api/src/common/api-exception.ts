import { HttpException } from '@nestjs/common';

/**
 * An error in the API's wire shape: `{ error: string, ...extra }`.
 *
 * Nest's default is `{ statusCode, message, error }`. Web's `handleApiError`
 * and the mobile app's `toApiError` both read `.error`, so emitting Nest's
 * shape would silently turn every failure into a generic message on both
 * clients (plan Part 4, row 1). Throw this, never Nest's built-ins.
 *
 * @example
 * throw new ApiException(404, 'Store not found');
 * throw new ApiException(409, 'Cannot move an order from PAID to PENDING', { allowed });
 * throw new ApiException(429, 'Too many attempts', {}, { 'Retry-After': '30' });
 */
export class ApiException extends HttpException {
  constructor(
    status: number,
    error: string | null,
    extra: Record<string, unknown> = {},
    readonly headers: Record<string, string> = {},
  ) {
    super({ ...extra, error }, status);
  }
}
