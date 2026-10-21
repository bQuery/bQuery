/** Absolute path of `src/export-map.json`. */
export declare const EXPORT_MAP_PATH: string;

/** Module subpaths (`core`, `view/compiler`, …) from the root `package.json` `exports`. */
export declare function readSubpaths(): Promise<string[]>;

/** Build the export → subpath map from the source barrels. */
export declare function buildExportMap(): Promise<{
  map: Record<string, string>;
  unmapped: string[];
}>;

/** Serialise the map as committed (Prettier-formatted JSON). */
export declare function formatExportMap(map: Record<string, string>): Promise<string>;
