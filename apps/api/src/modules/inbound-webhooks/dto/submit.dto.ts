/**
 * The submission body is shaped entirely by the webhook's own FormSchema, so
 * there is nothing meaningful for class-validator to assert here — the real
 * work is the Layer-2 payload validator. Declared as a type (not a DTO class
 * with decorators) so the global ValidationPipe does not strip unknown keys
 * before the schema has had a chance to see them.
 */
export type SubmitBody = Record<string, unknown>;
