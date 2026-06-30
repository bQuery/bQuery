#!/usr/bin/env node
/**
 * CLI launcher for the optional bQuery view compiler.
 *
 * Thin wrapper around `runCompileCli` from the built `view/compiler` entry.
 * Runs against the published `dist/` build; for local development run the
 * compiler programmatically from `src/view/compiler`.
 *
 * Usage: bquery-view-compile [options] <file...>
 */
import { runCompileCli } from '../dist/view-compiler.es.mjs';

const exitCode = await runCompileCli(process.argv.slice(2));
process.exit(exitCode);
