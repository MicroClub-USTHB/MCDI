/**
 * Declares the app's env vars as real properties on `ProcessEnv`.
 *
 * Two constraints meet here. Next.js only substitutes `NEXT_PUBLIC_*` values
 * into the client bundle where it sees the literal text
 * `process.env.NEXT_PUBLIC_FOO` — reading them off a variable, or handing
 * `process.env` wholesale to a validator, yields `undefined` in the browser.
 * But `tsconfig` sets `noPropertyAccessFromIndexSignature`, which rejects dot
 * access on `ProcessEnv`'s index signature. Declaring them here makes the dot
 * access legal without changing the source text Next needs to match.
 *
 * Left optional deliberately: at runtime they genuinely can be missing, and
 * `env.ts` exists to catch exactly that.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_API_URL?: string;
    readonly NEXT_PUBLIC_APP_URL?: string;
  }
}
