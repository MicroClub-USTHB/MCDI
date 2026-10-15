import { evaluateCondition, readPath } from './condition.evaluator';
import type { Condition } from './form-schema.types';

const data = {
  identity: { status: 'student', age: 22, tags: ['a', 'b'], name: 'Ada' },
  empty: { nothing: null },
};

describe('readPath', () => {
  it('reads a dotted path', () => {
    expect(readPath(data, 'identity.status')).toBe('student');
  });
  it('returns undefined for a missing path', () => {
    expect(readPath(data, 'identity.missing')).toBeUndefined();
    expect(readPath(data, 'no.such.path')).toBeUndefined();
  });
  it('does not throw when traversing through a scalar', () => {
    expect(readPath(data, 'identity.status.deeper')).toBeUndefined();
  });
});

describe('evaluateCondition with ./ item references', () => {
  const root = { identity: { kind: 'team' } };
  const lead = { role: 'lead', address: { city: 'Algiers' } };
  const member = { role: 'member' };

  it("reads ./field from the array item, not from the submission's root", () => {
    const condition: Condition = { op: 'eq', field: './role', value: 'lead' };

    expect(evaluateCondition(condition, root, lead)).toBe(true);
    expect(evaluateCondition(condition, root, member)).toBe(false);
  });

  it('reads a nested path inside the item', () => {
    const condition: Condition = {
      op: 'eq',
      field: './address.city',
      value: 'Algiers',
    };

    expect(evaluateCondition(condition, root, lead)).toBe(true);
    expect(evaluateCondition(condition, root, member)).toBe(false);
  });

  it('still reads absolute paths from the root while inside an item', () => {
    const condition: Condition = {
      op: 'eq',
      field: 'identity.kind',
      value: 'team',
    };

    expect(evaluateCondition(condition, root, member)).toBe(true);
  });

  it('combines item and root references', () => {
    const condition: Condition = {
      op: 'and',
      of: [
        { op: 'eq', field: './role', value: 'lead' },
        { op: 'eq', field: 'identity.kind', value: 'team' },
      ],
    };

    expect(evaluateCondition(condition, root, lead)).toBe(true);
    expect(evaluateCondition(condition, root, member)).toBe(false);
  });

  it('works under not, or and exists', () => {
    expect(
      evaluateCondition(
        { op: 'not', of: { op: 'eq', field: './role', value: 'lead' } },
        root,
        member,
      ),
    ).toBe(true);
    expect(
      evaluateCondition({ op: 'exists', field: './address.city' }, root, lead),
    ).toBe(true);
    expect(
      evaluateCondition(
        { op: 'exists', field: './address.city' },
        root,
        member,
      ),
    ).toBe(false);
  });

  it('is false, never an error, when there is no item to read from', () => {
    expect(
      evaluateCondition({ op: 'eq', field: './role', value: 'lead' }, root),
    ).toBe(false);
    expect(
      evaluateCondition({ op: 'ne', field: './role', value: 'lead' }, root),
    ).toBe(true);
  });
});

describe('evaluateCondition', () => {
  it('treats an absent condition as always active', () => {
    expect(evaluateCondition(undefined, data)).toBe(true);
  });

  describe('comparison operators', () => {
    const cases: [Condition, boolean][] = [
      [{ op: 'eq', field: 'identity.status', value: 'student' }, true],
      [{ op: 'eq', field: 'identity.status', value: 'pro' }, false],
      [{ op: 'ne', field: 'identity.status', value: 'pro' }, true],
      [{ op: 'gt', field: 'identity.age', value: 18 }, true],
      [{ op: 'gt', field: 'identity.age', value: 30 }, false],
      [{ op: 'lt', field: 'identity.age', value: 30 }, true],
      [{ op: 'gte', field: 'identity.age', value: 22 }, true],
      [{ op: 'lte', field: 'identity.age', value: 22 }, true],
      [{ op: 'in', field: 'identity.status', value: ['student', 'pro'] }, true],
      [{ op: 'in', field: 'identity.status', value: ['pro'] }, false],
      [{ op: 'contains', field: 'identity.tags', value: 'a' }, true],
      [{ op: 'contains', field: 'identity.tags', value: 'z' }, false],
      [{ op: 'contains', field: 'identity.name', value: 'Ad' }, true],
      [{ op: 'exists', field: 'identity.status' }, true],
      [{ op: 'exists', field: 'identity.missing' }, false],
      [{ op: 'exists', field: 'empty.nothing' }, false],
    ];
    it.each(cases)('%j → %s', (condition, expected) => {
      expect(evaluateCondition(condition, data)).toBe(expected);
    });
  });

  it('returns false when comparing mismatched types', () => {
    expect(
      evaluateCondition({ op: 'gt', field: 'identity.status', value: 5 }, data),
    ).toBe(false);
  });

  it('is safe on a missing path', () => {
    expect(
      evaluateCondition({ op: 'eq', field: 'a.b.c.d', value: 1 }, data),
    ).toBe(false);
  });

  describe('logical operators', () => {
    it('and', () => {
      expect(
        evaluateCondition(
          {
            op: 'and',
            of: [
              { op: 'eq', field: 'identity.status', value: 'student' },
              { op: 'gt', field: 'identity.age', value: 18 },
            ],
          },
          data,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          {
            op: 'and',
            of: [
              { op: 'eq', field: 'identity.status', value: 'student' },
              { op: 'gt', field: 'identity.age', value: 99 },
            ],
          },
          data,
        ),
      ).toBe(false);
    });

    it('or', () => {
      expect(
        evaluateCondition(
          {
            op: 'or',
            of: [
              { op: 'eq', field: 'identity.status', value: 'pro' },
              { op: 'gt', field: 'identity.age', value: 18 },
            ],
          },
          data,
        ),
      ).toBe(true);
    });

    it('not', () => {
      expect(
        evaluateCondition(
          {
            op: 'not',
            of: { op: 'eq', field: 'identity.status', value: 'pro' },
          },
          data,
        ),
      ).toBe(true);
    });

    it('nests', () => {
      expect(
        evaluateCondition(
          {
            op: 'and',
            of: [
              {
                op: 'not',
                of: { op: 'eq', field: 'identity.status', value: 'pro' },
              },
              {
                op: 'or',
                of: [
                  { op: 'lt', field: 'identity.age', value: 18 },
                  { op: 'contains', field: 'identity.tags', value: 'b' },
                ],
              },
            ],
          },
          data,
        ),
      ).toBe(true);
    });
  });
});
