// @ts-check
import base from '@mcdi/eslint-config/base';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**'] },
  ...base,
);
