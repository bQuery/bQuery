/**
 * Vite configuration for UMD/IIFE builds (CDN usage with script tags).
 *
 * This creates a single full.umd.js bundle for use with script tags.
 *
 * @example
 * ```html
 * <script src="https://unpkg.com/bquery@1/dist/full.umd.js"></script>
 * <script>
 *   const { $, signal } = bQuery;
 * </script>
 * ```
 */
import { resolve } from 'path';
import { defineConfig } from 'vite';

const banner = `/**
 * bQuery.js v${process.env.npm_package_version || '1.0.0'}
 * The jQuery for the Modern Web Platform
 * (c) ${new Date().getFullYear()} bQuery Contributors
 * Released under the MIT License
 */`;

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/full.ts'),
      name: 'bQuery',
      formats: ['umd', 'iife'],
      fileName: (format) => `full.${format}.js`,
    },
    outDir: 'dist',
    emptyOutDir: false, // Don't clear, we add to existing ESM builds
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        banner,
      },
    },
  },
});
