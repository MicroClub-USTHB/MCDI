/** Nest's default error body — `message` is an array when ValidationPipe rejects a DTO. */
export interface NestErrorBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}
