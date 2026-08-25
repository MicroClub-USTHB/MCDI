import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ChannelsExceptionFilter } from './channels-exception.filter';

function makeHost(request: Partial<Record<string, unknown>>): ArgumentsHost {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status, locals: {} as Record<string, unknown> };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return Object.assign(host, { __response: response, __json: json });
}

function caughtBody(host: ArgumentsHost): {
  statusCode: number;
  code: string;
  message: unknown;
} {
  const anyHost = host as unknown as {
    __response: { status: jest.Mock };
    __json: jest.Mock;
  };
  return anyHost.__json.mock.calls[0][0];
}

function responseLocals(host: ArgumentsHost): Record<string, unknown> {
  return (
    host as unknown as { __response: { locals: Record<string, unknown> } }
  ).__response.locals;
}

describe('ChannelsExceptionFilter', () => {
  const filter = new ChannelsExceptionFilter();

  it('passes through an explicit code already on the exception response', () => {
    const exception = new BadRequestException({
      code: 'INVALID_CONTENT',
      message: 'Either content or embeds must be provided',
    });
    const host = makeHost({
      method: 'POST',
      path: '/servers/1/channels/2/messages',
    });

    filter.catch(exception, host);

    expect(caughtBody(host)).toEqual({
      statusCode: 400,
      code: 'INVALID_CONTENT',
      message: 'Either content or embeds must be provided',
    });
  });

  it('infers RATE_LIMITED for a ThrottlerException (429)', () => {
    const exception = new ThrottlerException();
    const host = makeHost({
      method: 'POST',
      path: '/servers/1/channels/2/messages',
    });

    filter.catch(exception as unknown as HttpException, host);

    expect(caughtBody(host).code).toBe('RATE_LIMITED');
    expect(caughtBody(host).statusCode).toBe(429);
  });

  it('infers CHANNEL_NOT_FOUND for a plain 404', () => {
    const exception = new NotFoundException('Channel does not exist');
    const host = makeHost({ method: 'GET', path: '/servers/1/channels/2' });

    filter.catch(exception, host);

    expect(caughtBody(host).code).toBe('CHANNEL_NOT_FOUND');
  });

  it('infers NO_SEND_PERMISSION for a 403 mentioning SEND_MESSAGES', () => {
    const exception = new ForbiddenException(
      'Project is not allowed to perform SEND_MESSAGES on server 123',
    );
    const host = makeHost({
      method: 'POST',
      path: '/servers/1/channels/2/messages',
    });

    filter.catch(exception, host);

    expect(caughtBody(host).code).toBe('NO_SEND_PERMISSION');
  });

  it('falls back to FORBIDDEN for an unrelated 403 and stashes the reason for the audit middleware', () => {
    const exception = new ForbiddenException('Server not found or inactive');
    const host = makeHost({ method: 'GET', path: '/servers/1/channels' });

    filter.catch(exception, host);

    expect(caughtBody(host).code).toBe('FORBIDDEN');
    expect(responseLocals(host).authFailureReason).toBe(
      'Server not found or inactive',
    );
  });

  it('infers INVALID_CONTENT for a 400 on the send-message route', () => {
    const exception = new BadRequestException([
      'content must be shorter than or equal to 2000 characters',
    ]);
    const host = makeHost({
      method: 'POST',
      path: '/servers/1/channels/2/messages',
    });

    filter.catch(exception, host);

    expect(caughtBody(host).code).toBe('INVALID_CONTENT');
  });

  it('falls back to BAD_REQUEST for a 400 on a non-send-message route', () => {
    const exception = new BadRequestException('Invalid query parameters');
    const host = makeHost({ method: 'GET', path: '/servers/1/channels' });

    filter.catch(exception, host);

    expect(caughtBody(host).code).toBe('BAD_REQUEST');
  });
});
