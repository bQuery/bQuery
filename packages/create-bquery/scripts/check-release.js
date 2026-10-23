#!/usr/bin/env node
/**
 * `prepublishOnly` guard for the standalone `create-bquery` package.
 *
 * The templates are written against `BQUERY_VERSION` and may use APIs that
 * only exist from that release on. Publishing the scaffolder before that
 * bQuery release is on npm would give every new project an older bQuery its
 * templates do not run on, so this refuses to publish until it is.
 */
import { BQUERY_VERSION } from '../src/versions.js';

const url = `https://registry.npmjs.org/@bquery/bquery/${BQUERY_VERSION}`;
const response = await fetch(url, { headers: { accept: 'application/json' } });

if (!response.ok) {
  console.error(
    `create-bquery: @bquery/bquery@${BQUERY_VERSION} is not on npm (${response.status}). ` +
      'Publish that bQuery release first; the templates depend on it.'
  );
  process.exit(1);
}

console.log(`create-bquery: @bquery/bquery@${BQUERY_VERSION} is published.`);
