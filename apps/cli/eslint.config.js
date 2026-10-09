import tseslint from 'typescript-eslint';

export default tseslint.config(
  // landing-page/ is the Next.js landing page, linted by its own config.
  { ignores: ['dist/**', 'landing-page/**'] },
  ...tseslint.configs.recommended,
);
