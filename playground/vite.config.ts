import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      bquery: path.resolve(__dirname, '../src/index.ts'),
      'bquery/core': path.resolve(__dirname, '../src/core/index.ts'),
      'bquery/reactive': path.resolve(__dirname, '../src/reactive/index.ts'),
    },
  },
});
