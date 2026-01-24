/**
 * Vite configuration for bQuery.js library builds.
 *
 * This configuration creates multiple output formats for different use cases:
 * - ESM: Modern ES modules for bundlers and native imports
 * - UMD: Universal Module Definition for script tags and AMD
 *
 * @see https://vitejs.dev/guide/build.html#library-mode
 */
import { resolve } from 'path';
import { defineConfig } from 'vite';

/**
 * Entry points for the library build.
 * Each entry creates a separate bundle.
 */
const entries = {
  full: resolve(__dirname, 'src/full.ts'),
  index: resolve(__dirname, 'src/index.ts'),
  core: resolve(__dirname, 'src/core/index.ts'),
  reactive: resolve(__dirname, 'src/reactive/index.ts'),
  component: resolve(__dirname, 'src/component/index.ts'),
  motion: resolve(__dirname, 'src/motion/index.ts'),
  security: resolve(__dirname, 'src/security/index.ts'),
  platform: resolve(__dirname, 'src/platform/index.ts'),
  router: resolve(__dirname, 'src/router/index.ts'),
  store: resolve(__dirname, 'src/store/index.ts'),
  view: resolve(__dirname, 'src/view/index.ts'),
};

/**
 * Banner comment for built files.
 */
const banner = `/**
 * bQuery.js v${process.env.npm_package_version || '1.0.0'}
 * The jQuery for the Modern Web Platform
 * (c) ${new Date().getFullYear()} bQuery Contributors
 * Released under the MIT License
 */`;

export default defineConfig({
  build: {
    lib: {
      entry: entries,
      name: 'bQuery',
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.${format}.mjs`,
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        banner,
        // Ensure proper external handling
        preserveModules: false,
      },
    },
  },
  resolve: {
    alias: {
      bquery: resolve(__dirname, 'src'),
      'bquery/core': resolve(__dirname, 'src/core/index.ts'),
      'bquery/reactive': resolve(__dirname, 'src/reactive/index.ts'),
      'bquery/component': resolve(__dirname, 'src/component/index.ts'),
      'bquery/motion': resolve(__dirname, 'src/motion/index.ts'),
      'bquery/security': resolve(__dirname, 'src/security/index.ts'),
      'bquery/platform': resolve(__dirname, 'src/platform/index.ts'),
      'bquery/router': resolve(__dirname, 'src/router/index.ts'),
      'bquery/store': resolve(__dirname, 'src/store/index.ts'),
      'bquery/view': resolve(__dirname, 'src/view/index.ts'),
    },
  },
});
