import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  sourcemap: false,
  dts: false,
  // Workspace packages are private, so they ship inside the bundle, together
  // with the CommonJS modules they require: an ESM bundle cannot require() them.
  noExternal: [/^@mcdi\//, /^validator\//],
});
