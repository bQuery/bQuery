/**
 * The version these docs describe.
 *
 * Imported from the package manifest rather than hard-coded, so a release bump
 * is picked up by the site automatically. Vite turns the JSON into a module
 * with named exports, so only this string ends up in the bundle.
 */
import { version } from '../../../../package.json';

export { version };
