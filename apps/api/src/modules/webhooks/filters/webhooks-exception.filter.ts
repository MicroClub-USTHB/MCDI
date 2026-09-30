import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Normalizes every error thrown within the Webhooks module to
 * `{ statusCode, code, message }`, following the Channels module's filter.
 *
 * Throw sites we own (WebhooksService) attach an explicit `code` via
 * `new XException({ code, message })` and pass through untouched. For
 * exceptions thrown elsewhere (ApiKeyGuard's operation check,
 * class-validator's automatic 400s), a code is inferred from the status.
 */
@Catch(HttpException)
export class WebhooksExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();
    const bodyObj =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : undefined;

    const message =
      bodyObj?.message ?? (typeof body === 'string' ? body : exception.message);
    const code =
      typeof bodyObj?.code === 'string'
        ? bodyObj.code
        : this.inferCode(status as HttpStatus, message);

    response.status(status).json({ statusCode: status, code, message });
  }

  private inferCode(status: HttpStatus, message: unknown): string {
    switch (status) {
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.NOT_FOUND:
        return 'WEBHOOK_NOT_FOUND';
      case HttpStatus.FORBIDDEN:
        return String(message).includes('MANAGE_WEBHOOKS')
          ? 'NO_MANAGE_WEBHOOKS_PERMISSION'
          : 'FORBIDDEN';
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      default:
        return 'ERROR';
    }
  }
}
