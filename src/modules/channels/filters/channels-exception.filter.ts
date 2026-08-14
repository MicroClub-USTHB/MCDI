import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';

/**
 * Normalizes every error thrown within the Channels module to
 * `{ statusCode, code, message }`, matching the issue's error-code table
 * (INVALID_CONTENT, NO_SEND_PERMISSION, CHANNEL_NOT_FOUND, RATE_LIMITED).
 *
 * Throw sites we own (ChannelsService, ChannelAccessGuard) already attach an
 * explicit `code` via `new XException({ code, message })` — this filter
 * passes those through untouched. For exceptions we don't own the throw site
 * for (ApiKeyGuard's operation check, @nestjs/throttler's ThrottlerException,
 * class-validator's automatic 400s), it infers a code from the status and
 * request context.
 */
@Catch(HttpException)
export class ChannelsExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
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
        : this.inferCode(status as HttpStatus, request, message);

    response.status(status).json({ statusCode: status, code, message });
  }

  private inferCode(
    status: HttpStatus,
    request: Request,
    message: unknown,
  ): string {
    switch (status) {
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      case HttpStatus.NOT_FOUND:
        return 'CHANNEL_NOT_FOUND';
      case HttpStatus.FORBIDDEN:
        return String(message).includes('SEND_MESSAGES')
          ? 'NO_SEND_PERMISSION'
          : 'FORBIDDEN';
      case HttpStatus.BAD_REQUEST:
        return request.method === 'POST' && request.path.endsWith('/messages')
          ? 'INVALID_CONTENT'
          : 'BAD_REQUEST';
      default:
        return 'ERROR';
    }
  }
}
