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
import { defineConfig, type Plugin } from 'vite';

/** Absolute path to the repository root (this file's directory). */
const rootDir = import.meta.dirname;

const banner = `/**
 * bQuery.js v${process.env.npm_package_version || '1.0.0'}
 * The full-stack web framework that speaks jQuery.
 * (c) ${new Date().getFullYear()} bQuery Contributors
 * Released under the MIT License
 */`;

/** Prefix for the virtual stub modules created by {@link stubNodeBuiltins}. */
const NODE_STUB_PREFIX = '\0bquery:node-stub:';

/**
 * Replaces Node built-ins with a stub module in the browser bundle.
 *
 * `createServer().listen()` dynamically imports `node:http` on its Node
 * runtime branch, which is unreachable in a browser. Without this plugin Vite
 * substitutes its own browser-external stub and logs a warning on every build.
 * The stub throws on evaluation, so the dynamic import rejects with a message
 * that names the missing module instead of failing later with a cryptic
 * "not a function".
 */
function stubNodeBuiltins(): Plugin {
  return {
    name: 'bquery:stub-node-builtins',
    enforce: 'pre',
    resolveId(id) {
      return id.startsWith('node:') ? `${NODE_STUB_PREFIX}${id}` : null;
    },
    load(id) {
      if (!id.startsWith(NODE_STUB_PREFIX)) return null;
      const moduleName = id.slice(NODE_STUB_PREFIX.length);
      return `throw new Error('[bQuery] "${moduleName}" is not available in the browser bundle. Use the ESM build on a server runtime instead.');\n`;
    },
  };
}

export default defineConfig({
  plugins: [stubNodeBuiltins()],
  build: {
    lib: {
      entry: resolve(rootDir, 'src/full.ts'),
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
