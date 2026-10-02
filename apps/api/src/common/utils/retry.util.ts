export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  logger: { warn: (message: string) => void },
  maxAttempts = 3,
  retryDelayMs = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        `Retry ${attempt}/${maxAttempts} for ${context} failed: ${lastError.message}`,
      );

      if (attempt < maxAttempts) {
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error('Operation failed');
}
