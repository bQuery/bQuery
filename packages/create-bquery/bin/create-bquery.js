#!/usr/bin/env node
// `npm create bquery@latest` entry point. See `src/cli.js`.
import { run } from '../src/cli.js';

process.exitCode = await run(process.argv.slice(2));
