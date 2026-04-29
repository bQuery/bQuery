/** Shared internal brand for SSR deferred values and tagged loaders. */
declare const _deferBrandSymbol: unique symbol;
export const DEFER_BRAND = Symbol.for('bquery.ssr.defer') as typeof _deferBrandSymbol;
