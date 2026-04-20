import { defineConfig } from 'tsup';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  entry: ['bin/cashop-console.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  dts: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
  // Bundle the workspace-local @cashop/core inline for the same reason as cli-c:
  // GitHub Packages registry does not carry @cashop/core, so admin must ship a
  // self-contained bundle.
  noExternal: ['@cashop/core'],
});
