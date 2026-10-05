import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AppThrottlerGuard, SkipGlobalThrottle } from './app-throttler.guard';

@Controller()
class ProbeController {
  @Get('default')
  byDefault() {
    return 'ok';
  }

  @Get('override')
  @Throttle({ default: { ttl: 60_000, limit: 1 } })
  override() {
    return 'ok';
  }

  @Get('skipped')
  @SkipGlobalThrottle()
  skipped() {
    return 'ok';
  }
}

describe('AppThrottlerGuard', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }])],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  const statuses = async (path: string, n: number) => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      out.push((await request(app.getHttpServer()).get(path)).status);
    }
    return out;
  };

  it('applies the configured default limit to routes without @Throttle', async () => {
    expect(await statuses('/default', 3)).toEqual([200, 200, 429]);
  });

  it('lets a route-level @Throttle override the default', async () => {
    expect(await statuses('/override', 2)).toEqual([200, 429]);
  });

  it('does not limit routes marked @SkipGlobalThrottle', async () => {
    expect(await statuses('/skipped', 5)).toEqual([200, 200, 200, 200, 200]);
  });
});
