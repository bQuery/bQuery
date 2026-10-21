#!/usr/bin/env node
/**
 * `create-bquery` launcher shipped with `@bquery/bquery`.
 *
 * The scaffolder lives in `packages/create-bquery` and is also published on
 * its own as `create-bquery`, so `npm create bquery@latest` keeps working.
 * This entry makes the same CLI available after `npm install @bquery/bquery`:
 *
 *   npx create-bquery my-app --template spa
 */
import { run } from '../packages/create-bquery/src/cli.js';

process.exitCode = await run(process.argv.slice(2));
