import { Injectable } from '@nestjs/common';

export const CLOCK = 'CLOCK';

export interface Clock {
  now(): Date;
}

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
