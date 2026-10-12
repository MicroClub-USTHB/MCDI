/** Exit code 5 matches the PRD's "network/unexpected error" bucket until real codes are wired up per command. */
export function notImplemented(command: string, issue?: number): never {
  const tracking = issue ? ` (tracked in issue #${issue})` : '';
  process.stderr.write(`mcdi-cli ${command}: not implemented yet${tracking}\n`);
  process.exit(5);
}
