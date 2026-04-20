import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/entry.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  dts: false,
  shims: false,
  // src/entry.ts already begins with `#!/usr/bin/env node`; tsup preserves it.
  // Bundle the workspace-local @cashop/core inline so the released tarball
  // stays self-contained under `npm install --omit=dev` (which cannot resolve
  // a workspace:* dep). All other deps stay external and come from npm.
  noExternal: ['@cashop/core'],
});
