/**
 * Generic exponential-backoff retry wrapper.
 * Keeps retry logic out of individual services and makes it independently
 * testable.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  logger: { warn: (msg: string) => void },
  maxRetries = 3,
  retryDelayMs = 1000,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        `Retry ${attempt}/${maxRetries} for ${context} failed: ${lastError.message}`,
      );
      if (attempt < maxRetries) {
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
