import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

export const TOKEN_GENERATOR = 'TOKEN_GENERATOR';

export interface TokenGenerator {
  randomHex(bytes: number): string;
}

@Injectable()
export class CryptoTokenGenerator implements TokenGenerator {
  randomHex(bytes: number): string {
    return randomBytes(bytes).toString('hex');
  }
}
