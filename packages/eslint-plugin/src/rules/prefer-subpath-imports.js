/**
 * `prefer-subpath-imports` — import from `@bquery/bquery/<module>` instead of
 * the root `@bquery/bquery` entry, which re-exports every module.
 *
 * The export → subpath map is generated from the source barrels by
 * `scripts/generate-export-map.mjs`.
 *
 * @module @bquery/eslint-plugin/rules/prefer-subpath-imports
 */

import exportMap from '../export-map.json' with { type: 'json' };
import { PACKAGE_NAME, docsUrl, specifierName } from '../utils.js';

/** @type {Record<string, string>} */
const SUBPATHS = exportMap.exports;

/**
 * Look up the subpath that exports a name.
 *
 * @param {string} name - Exported name
 * @returns {string | undefined} The subpath, e.g. `reactive`
 */
const subpathOf = (name) => (Object.hasOwn(SUBPATHS, name) ? SUBPATHS[name] : undefined);

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'Prefer `@bquery/bquery/<module>` subpath imports over the root `@bquery/bquery` entry',
      recommended: true,
      url: docsUrl('prefer-subpath-imports'),
    },
    schema: [],
    messages: {
      preferSubpath: "Import from '{{source}}' instead of the root '@bquery/bquery' entry.",
      preferSubpaths:
        "Split this import into subpath imports ({{sources}}) instead of the root '@bquery/bquery' entry.",
      unknownExport:
        "Prefer subpath imports over the root '@bquery/bquery' entry. '{{name}}' has no known subpath, so this import is not fixed automatically.",
    },
  },

  create(context) {
    const { sourceCode } = context;
    return {
      ImportDeclaration(node) {
        if (node.source.value !== PACKAGE_NAME) return;
        // Side-effect and namespace imports have no per-name subpath.
        if (
          node.specifiers.length === 0 ||
          node.specifiers.some((specifier) => specifier.type === 'ImportNamespaceSpecifier')
        ) {
          return;
        }

        /** subpath → specifiers, in first-seen order */
        const groups = new Map();
        for (const specifier of node.specifiers) {
          const name =
            specifier.type === 'ImportSpecifier' ? specifierName(specifier.imported) : 'default';
          const subpath = subpathOf(name);
          if (!subpath) {
            context.report({ node, messageId: 'unknownExport', data: { name } });
            return;
          }
          const group = groups.get(subpath) ?? [];
          group.push(specifier);
          groups.set(subpath, group);
        }

        const raw = sourceCode.getText(node.source);
        const quote = raw[0] === '"' ? '"' : "'";
        const sourceFor = (subpath) => `${PACKAGE_NAME}/${subpath}`;
        const hasAttributes = (node.attributes ?? node.assertions ?? []).length > 0;

        if (groups.size === 1) {
          const [subpath] = groups.keys();
          context.report({
            node,
            messageId: 'preferSubpath',
            data: { source: sourceFor(subpath) },
            fix: (fixer) => fixer.replaceText(node.source, `${quote}${sourceFor(subpath)}${quote}`),
          });
          return;
        }

        // Splitting rebuilds the statement: skip when that would drop comments
        // or import attributes.
        const canSplit = !hasAttributes && sourceCode.getCommentsInside(node).length === 0;
        const typeKeyword = node.importKind === 'type' ? ' type' : '';
        const semicolon = sourceCode.getText(node).trimEnd().endsWith(';') ? ';' : '';
        const indent = ' '.repeat(node.loc.start.column);
        context.report({
          node,
          messageId: 'preferSubpaths',
          data: {
            sources: [...groups.keys()].map((subpath) => `'${sourceFor(subpath)}'`).join(', '),
          },
          fix: canSplit
            ? (fixer) =>
                fixer.replaceText(
                  node,
                  [...groups]
                    .map(([subpath, specifiers]) => {
                      const names = specifiers.map((specifier) => sourceCode.getText(specifier));
                      const source = `${quote}${sourceFor(subpath)}${quote}`;
                      return `import${typeKeyword} { ${names.join(', ')} } from ${source}${semicolon}`;
                    })
                    .join(`\n${indent}`)
                )
            : null,
        });
      },
    };
  },
};
