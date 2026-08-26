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

/** Absolute path to the repository root (this file's directory). */
const rootDir = import.meta.dirname;

/**
 * Entry points for the library build.
 * Each entry creates a separate bundle.
 */
const entries = {
  full: resolve(rootDir, 'src/full.ts'),
  index: resolve(rootDir, 'src/index.ts'),
  core: resolve(rootDir, 'src/core/index.ts'),
  reactive: resolve(rootDir, 'src/reactive/index.ts'),
  concurrency: resolve(rootDir, 'src/concurrency/index.ts'),
  component: resolve(rootDir, 'src/component/index.ts'),
  motion: resolve(rootDir, 'src/motion/index.ts'),
  security: resolve(rootDir, 'src/security/index.ts'),
  platform: resolve(rootDir, 'src/platform/index.ts'),
  router: resolve(rootDir, 'src/router/index.ts'),
  store: resolve(rootDir, 'src/store/index.ts'),
  view: resolve(rootDir, 'src/view/index.ts'),
  'view-compiler': resolve(rootDir, 'src/view/compiler/index.ts'),
  storybook: resolve(rootDir, 'src/storybook/index.ts'),
  forms: resolve(rootDir, 'src/forms/index.ts'),
  i18n: resolve(rootDir, 'src/i18n/index.ts'),
  'i18n-extract': resolve(rootDir, 'src/i18n/extract/index.ts'),
  a11y: resolve(rootDir, 'src/a11y/index.ts'),
  dnd: resolve(rootDir, 'src/dnd/index.ts'),
  media: resolve(rootDir, 'src/media/index.ts'),
  plugin: resolve(rootDir, 'src/plugin/index.ts'),
  devtools: resolve(rootDir, 'src/devtools/index.ts'),
  testing: resolve(rootDir, 'src/testing/index.ts'),
  ssr: resolve(rootDir, 'src/ssr/index.ts'),
  server: resolve(rootDir, 'src/server/index.ts'),
};

/**
 * Banner comment for built files.
 */
const banner = `/**
 * bQuery.js v${process.env.npm_package_version || '1.0.0'}
 * The full-stack web framework that speaks jQuery.
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
      // Keep Node built-ins external so the optional CLI entries (view
      // compiler, i18n extractor) emit real `import('node:fs/promises')`
      // calls instead of Vite's browser-external stub. Without this, the
      // bundled CLIs crash at runtime ("e is not a function"). Browser entries
      // never import `node:*`, so this is a no-op for them.
      external: (id) => id.startsWith('node:'),
      output: {
        banner,
        // Ensure proper external handling
        preserveModules: false,
      },
    },
  },
  resolve: {
    alias: {
      bquery: resolve(rootDir, 'src'),
      'bquery/core': resolve(rootDir, 'src/core/index.ts'),
      'bquery/reactive': resolve(rootDir, 'src/reactive/index.ts'),
      'bquery/concurrency': resolve(rootDir, 'src/concurrency/index.ts'),
      'bquery/component': resolve(rootDir, 'src/component/index.ts'),
      'bquery/motion': resolve(rootDir, 'src/motion/index.ts'),
      'bquery/security': resolve(rootDir, 'src/security/index.ts'),
      'bquery/platform': resolve(rootDir, 'src/platform/index.ts'),
      'bquery/router': resolve(rootDir, 'src/router/index.ts'),
      'bquery/store': resolve(rootDir, 'src/store/index.ts'),
      'bquery/view/compiler': resolve(rootDir, 'src/view/compiler/index.ts'),
      'bquery/view': resolve(rootDir, 'src/view/index.ts'),
      'bquery/storybook': resolve(rootDir, 'src/storybook/index.ts'),
      'bquery/forms': resolve(rootDir, 'src/forms/index.ts'),
      'bquery/i18n/extract': resolve(rootDir, 'src/i18n/extract/index.ts'),
      'bquery/i18n': resolve(rootDir, 'src/i18n/index.ts'),
      'bquery/a11y': resolve(rootDir, 'src/a11y/index.ts'),
      'bquery/dnd': resolve(rootDir, 'src/dnd/index.ts'),
      'bquery/media': resolve(rootDir, 'src/media/index.ts'),
      'bquery/plugin': resolve(rootDir, 'src/plugin/index.ts'),
      'bquery/devtools': resolve(rootDir, 'src/devtools/index.ts'),
      'bquery/testing': resolve(rootDir, 'src/testing/index.ts'),
      'bquery/ssr': resolve(rootDir, 'src/ssr/index.ts'),
      'bquery/server': resolve(rootDir, 'src/server/index.ts'),
    },
  },
});
