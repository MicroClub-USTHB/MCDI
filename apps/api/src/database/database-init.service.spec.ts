import { Logger } from '@nestjs/common';
import { DatabaseInitService } from './database-init.service';

function build(mainRows: { id: string }[]) {
  const db: any = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(mainRows),
      }),
    }),
  };
  return new DatabaseInitService(db);
}

describe('DatabaseInitService.checkMainServer', () => {
  const env = { ...process.env };
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    process.env.MC_GUILD_ID = 'guild-1';
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });

  it('passes when the database main server matches MC_GUILD_ID', async () => {
    await expect(
      build([{ id: 'guild-1' }]).checkMainServer(),
    ).resolves.toBeUndefined();
  });

  it('fails the boot in production on a mismatch', async () => {
    await expect(build([{ id: 'guild-2' }]).checkMainServer()).rejects.toThrow(
      /guild-2.*MC_GUILD_ID.*guild-1/,
    );
  });

  it('only warns outside production on a mismatch', async () => {
    process.env.NODE_ENV = 'development';
    await expect(
      build([{ id: 'guild-2' }]).checkMainServer(),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('passes when there is no main server', async () => {
    await expect(build([]).checkMainServer()).resolves.toBeUndefined();
  });

  it('passes when MC_GUILD_ID is not set', async () => {
    delete process.env.MC_GUILD_ID;
    await expect(
      build([{ id: 'guild-2' }]).checkMainServer(),
    ).resolves.toBeUndefined();
  });
});
