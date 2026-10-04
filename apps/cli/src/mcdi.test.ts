import { describe, expect, it } from 'vitest';
import { CliError, ExitCode } from './errors.js';
import { parseRotatedSecret } from './mcdi.js';

describe('parseRotatedSecret', () => {
  it('returns the signing secret from a well-shaped response', () => {
    expect(parseRotatedSecret({ signingSecret: 'whsec_abc123' })).toBe('whsec_abc123');
  });

  it('rejects a response missing signingSecret, or where it is not a string', () => {
    for (const body of [null, undefined, {}, { signingSecret: 123 }, { signingSecret: null }]) {
      expect(() => parseRotatedSecret(body)).toThrow(CliError);
      try {
        parseRotatedSecret(body);
        expect.unreachable();
      } catch (err) {
        expect((err as CliError).exitCode).toBe(ExitCode.Unexpected);
        expect((err as CliError).message).toMatch(/unexpected shape/);
      }
    }
  });
});
