import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that returns 405 Method Not Allowed for any HTTP method not
 * supported by this API. The API supports only the standard REST methods below.
 *
 * RFC 9110 §15.5.6 requires responses with 405 to include an `Allow` header
 * listing the valid methods.
 *
 * NestJS returns 404 by default for unknown routes regardless of method, which
 * misleads API fuzzers/validators. By checking against an allowlist (not a
 * denylist) we catch all non-standard methods (TRACE, CONNECT, QUERY, COPY,
 * LOCK, MOVE, SEARCH, etc.) in a single place.
 */
@Injectable()
export class MethodNotAllowedMiddleware implements NestMiddleware {
  private readonly allowedMethods = new Set([
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS',
  ]);

  private readonly allowHeader = 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS';

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.allowedMethods.has(req.method.toUpperCase())) {
      res
        .status(405)
        .header('Allow', this.allowHeader)
        .json({
          statusCode: 405,
          error: 'Method Not Allowed',
          message: `HTTP method ${req.method} is not allowed.`,
        });
      return;
    }
    next();
  }
}
