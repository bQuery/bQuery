/** The bQuery release the templates are written against (exact, for CDN URLs). */
export declare const BQUERY_VERSION: string;

/** The dependency range written into scaffolded `package.json` / `deno.json` files. */
export declare const BQUERY_RANGE: string;

/** Dev-dependency ranges written into scaffolded projects. */
export declare const DEV_DEPENDENCY_RANGES: Readonly<{
  '@types/node': string;
  'happy-dom': string;
  typescript: string;
  vite: string;
}>;
