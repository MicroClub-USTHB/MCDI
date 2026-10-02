import {
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
  HttpException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Response } from 'express';

interface PostgresError {
  code?: unknown;
  cause?: {
    code?: unknown;
  };
}

@Catch()
export class PostgresExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PostgresExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    let pgCode: string | undefined;

    if (exception && typeof exception === 'object') {
      const err = exception as PostgresError;
      // Drizzle typically throws errors from the underlying pg driver
      // The driver attaches a .code property for Postgres error codes
      if (typeof err.code === 'string') {
        pgCode = err.code;
      } else if (err.cause && typeof err.cause.code === 'string') {
        pgCode = err.cause.code;
      }
    }

    if (pgCode) {
      // 22001 = string data right truncation
      // 22021 = invalid byte sequence for encoding "UTF8" (e.g. \x00 null bytes)
      // 22P02 = invalid text representation (e.g. invalid uuid format)
      if (['22001', '22021', '22P02'].includes(pgCode)) {
        const response = host.switchToHttp().getResponse<Response>();
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Invalid parameter or data format provided.',
        });
      }

      // 23503 = foreign_key_violation
      // 23505 = unique_violation
      if (['23503', '23505'].includes(pgCode)) {
        const response = host.switchToHttp().getResponse<Response>();
        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'Database conflict or constraint violation.',
        });
      }
    }

    // Ensure HttpExceptions always have a JSON body (prevents empty 400s
    // when Express rejects requests with malformed headers).
    if (exception instanceof HttpException) {
      const response = host.switchToHttp().getResponse<Response>();
      const status = exception.getStatus();
      const body = exception.getResponse();
      // Read by AuditLoggingMiddleware on finish to record the failed
      // attempt with the reason the guard gave.
      if (status === 401 || status === 403) {
        response.locals.authFailureReason = exception.message;
      }
      if (response.headersSent) return;
      if (typeof body === 'string') {
        return response.status(status).json({
          statusCode: status,
          error: exception.message,
          message: body,
        });
      }
      return response.status(status).json(body);
    }

    super.catch(exception, host);
  }
}
