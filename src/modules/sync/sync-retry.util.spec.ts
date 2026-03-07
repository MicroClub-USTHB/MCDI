import { withRetry } from './sync-retry.util';

describe('withRetry', () => {
  const noopLogger = { warn: jest.fn() };

  afterEach(() => jest.clearAllMocks());

  it('returns the result immediately on first success', async () => {
    const op = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(op, 'test', noopLogger, 3, 0);
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on a later attempt', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce(new Error('first fail'))
      .mockResolvedValueOnce('recovered');
    const result = await withRetry(op, 'test', noopLogger, 3, 0);
    expect(result).toBe('recovered');
    expect(op).toHaveBeenCalledTimes(2);
    expect(noopLogger.warn).toHaveBeenCalledTimes(1);
  });

  it('throws the last error after all retries are exhausted', async () => {
    const op = jest.fn().mockRejectedValue(new Error('persistent'));
    await expect(withRetry(op, 'test', noopLogger, 3, 0)).rejects.toThrow('persistent');
    expect(op).toHaveBeenCalledTimes(3);
    expect(noopLogger.warn).toHaveBeenCalledTimes(3);
  });

  it('wraps non-Error rejections in an Error', async () => {
    const op = jest.fn().mockRejectedValue('string error');
    await expect(withRetry(op, 'test', noopLogger, 1, 0)).rejects.toBeInstanceOf(Error);
  });
});
