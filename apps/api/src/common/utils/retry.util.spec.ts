import { withRetry } from './retry.util';

describe('withRetry', () => {
  const noopLogger = { warn: jest.fn() };

  afterEach(() => jest.clearAllMocks());

  it('returns the result immediately on first success', async () => {
    const operation = jest.fn().mockResolvedValue('ok');

    const result = await withRetry(operation, 'test', noopLogger, 3, 0);

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on a later attempt', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(operation, 'test', noopLogger, 3, 0);

    expect(result).toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(noopLogger.warn).toHaveBeenCalledTimes(1);
  });

  it('throws the last error after all attempts are exhausted', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('persistent'));

    await expect(
      withRetry(operation, 'test', noopLogger, 3, 0),
    ).rejects.toThrow('persistent');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(noopLogger.warn).toHaveBeenCalledTimes(3);
  });

  it('wraps non-Error rejections in an Error', async () => {
    const operation = jest.fn().mockRejectedValue('string error');

    await expect(
      withRetry(operation, 'test', noopLogger, 1, 0),
    ).rejects.toBeInstanceOf(Error);
  });
});
