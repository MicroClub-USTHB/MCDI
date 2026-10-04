import { describe, expect, it } from 'vitest';
import { slugFromName } from './webhook-flow.js';

describe('slugFromName', () => {
  it('lowercases, strips accents, and collapses everything else to single dashes', () => {
    expect(slugFromName('Recruitment 2027')).toBe('recruitment-2027');
    expect(slugFromName('  Événement — Été!! ')).toBe('evenement-ete');
    expect(slugFromName('x'.repeat(80))).toHaveLength(64);
    expect(slugFromName('!!')).toBe('');
  });
});
