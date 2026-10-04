/** Exit codes from the PRD (§11). */
export const ExitCode = {
  Ok: 0,
  PrecheckFailed: 1,
  Rejected: 2,
  Auth: 3,
  NotFound: 4,
  Unexpected: 5,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

/** An error carrying the exit code the CLI should terminate with. */
export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: ExitCode,
  ) {
    super(message);
    this.name = 'CliError';
  }
}

/** Prints an error and exits with its code; anything that isn't a CliError counts as unexpected. */
export function exitWithError(command: string, err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof CliError ? err.exitCode : ExitCode.Unexpected;
  process.stderr.write(`mcdi-cli ${command}: ${message}\n`);
  process.exit(code);
}
