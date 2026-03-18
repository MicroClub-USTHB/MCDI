import { ForbiddenException } from '@nestjs/common';
import { isAdminMember } from './admin.util';

/** Build a sequential mock DB that returns each `rows` array in order per call.
 *  Works for queries ending in .limit() AND for queries that end in .where()/.innerJoin()
 *  (each call to db.select() returns a fresh thenable chain so db itself stays non-thenable). */
function buildSequentialMockDb(results: unknown[][]): any {
  let callIndex = 0;

  const nextResult = () => {
    const rows = results[callIndex] ?? [];
    callIndex++;
    return rows;
  };

  const makeChain = (): any => {
    const chain: any = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.where = jest.fn().mockReturnValue(chain);
    chain.innerJoin = jest.fn().mockReturnValue(chain);
    chain.limit = jest
      .fn()
      .mockImplementation(() => Promise.resolve(nextResult()));
    // Thenable: allows `await db.select()...where()` without an explicit .limit()
    chain.then = (
      resolve: (v: unknown) => void,
      reject?: (e: unknown) => void,
    ) => Promise.resolve(nextResult()).then(resolve, reject);
    return chain;
  };

  // db itself is NOT thenable — only per-query chains are
  return { select: jest.fn().mockImplementation(makeChain) };
}

describe('isAdminMember', () => {
  const MEMBER_ID = 'member-123';

  it('throws ForbiddenException when no main server is configured', async () => {
    const db = buildSequentialMockDb([
      [], // no main server found
    ]);
    await expect(isAdminMember(db, MEMBER_ID)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns false when member is not in the main server', async () => {
    const db = buildSequentialMockDb([
      [{ id: 'guild-1' }], // main server found
      [], // member not in server
    ]);
    const result = await isAdminMember(db, MEMBER_ID);
    expect(result).toBe(false);
  });

  it('returns false when member has no admin role', async () => {
    const db = buildSequentialMockDb([
      [{ id: 'guild-1' }], // main server
      [{ memberId: MEMBER_ID }], // membership confirmed
      [{ name: 'Member' }, { name: 'Guest' }], // roles — none are Lead/Executive
    ]);
    const result = await isAdminMember(db, MEMBER_ID);
    expect(result).toBe(false);
  });

  it('returns true when member holds the Executive role', async () => {
    const db = buildSequentialMockDb([
      [{ id: 'guild-1' }],
      [{ memberId: MEMBER_ID }],
      [{ name: 'Executive' }],
    ]);
    const result = await isAdminMember(db, MEMBER_ID);
    expect(result).toBe(true);
  });

  it('returns true when member holds the Lead role', async () => {
    const db = buildSequentialMockDb([
      [{ id: 'guild-1' }],
      [{ memberId: MEMBER_ID }],
      [{ name: 'Lead' }, { name: 'Member' }],
    ]);
    const result = await isAdminMember(db, MEMBER_ID);
    expect(result).toBe(true);
  });
});
