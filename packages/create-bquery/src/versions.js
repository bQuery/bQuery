/**
 * Versions written into scaffolded projects.
 *
 * The published scaffolder cannot read the bQuery repository, so the version
 * is stored here. `test/versions.test.ts` fails when it drifts from the root
 * `package.json`, and when the dev-dependency ranges drift from the ones the
 * repository itself is tested with. Templates only use APIs that exist in
 * `BQUERY_VERSION` — which, being the root version, is the release that ships
 * this copy of the scaffolder. `@bquery/bquery` carries it as the
 * `create-bquery` bin, so the two always come out together; the standalone
 * package's `prepublishOnly` (`scripts/check-release.js`) refuses to publish
 * before that release is on npm.
 */

/** The bQuery release the templates are written against (exact, for CDN URLs). */
export const BQUERY_VERSION = '1.17.2';

/** The dependency range written into scaffolded `package.json` / `deno.json` files. */
export const BQUERY_RANGE = `^${BQUERY_VERSION}`;

/**
 * Dev-dependency ranges written into scaffolded projects. Those the repository
 * also depends on must match its root `package.json`; `@types/node` follows the
 * Node.js major the templates target.
 */
export const DEV_DEPENDENCY_RANGES = Object.freeze({
  '@types/node': '^24.0.0',
  'happy-dom': '^21.0.4',
  typescript: '^6.0.3',
  vite: '^8.3.5',
});
