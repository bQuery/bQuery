#!/usr/bin/env node
/**
 * CLI launcher for bQuery i18n tooling.
 *
 * Thin wrapper around `runExtractCli` from the built `i18n/extract` entry.
 * Runs against the published `dist/` build; for local development run the
 * extractor programmatically from `src/i18n/extract`.
 *
 * Usage: bquery-i18n extract [options] <glob...>
 */
import { runExtractCli } from '../dist/i18n-extract.es.mjs';

const exitCode = await runExtractCli(process.argv.slice(2));
process.exit(exitCode);
