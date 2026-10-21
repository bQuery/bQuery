/**
 * Shared helpers for the bQuery ESLint rules.
 *
 * @module @bquery/eslint-plugin/utils
 */

/** The bQuery package name. */
export const PACKAGE_NAME = '@bquery/bquery';

/** Base URL of the rule documentation. */
const DOCS_BASE = 'https://bquery.js.org/guide/eslint-plugin';

/**
 * Build the documentation URL for a rule.
 *
 * @param {string} ruleName - Rule name without the plugin prefix
 * @returns {string} The URL of the rule's section in the guide
 */
export const docsUrl = (ruleName) => `${DOCS_BASE}#${ruleName}`;

/**
 * Build the list of import sources that expose a bQuery module: the root
 * entry, the `/full` bundle and the module's own subpath(s).
 *
 * @param {...string} subpaths - Module subpaths such as `reactive`
 * @returns {Set<string>} Import specifiers that re-export the module
 */
export const bquerySources = (...subpaths) =>
  new Set([
    PACKAGE_NAME,
    `${PACKAGE_NAME}/full`,
    ...subpaths.map((subpath) => `${PACKAGE_NAME}/${subpath}`),
  ]);

/** Function node types. */
const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/**
 * Whether a node is a function declaration or expression.
 *
 * @param {import('estree').Node | null | undefined} node - Node to test
 * @returns {boolean} True for function declarations, expressions and arrows
 */
export const isFunction = (node) => Boolean(node && FUNCTION_TYPES.has(node.type));

/**
 * Find the variable a name refers to, starting at `scope` and walking up.
 *
 * @param {import('eslint').Scope.Scope | null} scope - Innermost scope
 * @param {string} name - Variable name
 * @returns {import('eslint').Scope.Variable | null} The variable, if declared
 */
export const findVariable = (scope, name) => {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name);
    if (variable) return variable;
  }
  return null;
};

/**
 * Name of an import/export specifier part (`Identifier` or string `Literal`).
 *
 * @param {import('estree').Identifier | import('estree').Literal} node - Name node
 * @returns {string} The name
 */
export const specifierName = (node) =>
  node.type === 'Identifier' ? node.name : String(node.value);

/**
 * Describe the import a variable is bound to.
 *
 * @param {import('eslint').Scope.Variable | null} variable - Variable to inspect
 * @returns {{ source: string, imported: string | null, declaration: any } | null}
 *   The import source and imported name (`null` for namespace imports), or
 *   `null` when the variable is not an import binding
 */
export const importOfVariable = (variable) => {
  const def = variable?.defs[0];
  if (!def || def.type !== 'ImportBinding') return null;
  const declaration = def.parent;
  const source = String(declaration.source.value);
  const specifier = def.node;
  if (specifier.type === 'ImportSpecifier') {
    return { source, imported: specifierName(specifier.imported), declaration };
  }
  if (specifier.type === 'ImportDefaultSpecifier') {
    return { source, imported: 'default', declaration };
  }
  return { source, imported: null, declaration };
};

/**
 * Resolve a callee (an identifier or a `namespace.member` expression) to the
 * bQuery export it refers to.
 *
 * @param {import('eslint').Rule.RuleContext} context - Rule context
 * @param {import('estree').Node} node - The callee or tag expression
 * @param {Set<string>} sources - Accepted import sources
 * @returns {{ name: string, source: string, namespace: boolean } | null}
 *   The imported name, or `null` when the node is not a bQuery import
 */
export const resolveImported = (context, node, sources) => {
  const scope = context.sourceCode.getScope(node);
  if (node.type === 'Identifier') {
    const info = importOfVariable(findVariable(scope, node.name));
    if (!info || info.imported === null || !sources.has(info.source)) return null;
    return { name: info.imported, source: info.source, namespace: false };
  }
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.property.type === 'Identifier'
  ) {
    const info = importOfVariable(findVariable(scope, node.object.name));
    if (!info || info.imported !== null || !sources.has(info.source)) return null;
    return { name: node.property.name, source: info.source, namespace: true };
  }
  return null;
};

/**
 * Resolve a call's callee to one of the given bQuery exports.
 *
 * @param {import('eslint').Rule.RuleContext} context - Rule context
 * @param {import('estree').CallExpression} call - The call expression
 * @param {Set<string>} sources - Accepted import sources
 * @param {Set<string>} names - Accepted export names
 * @returns {{ name: string, source: string, namespace: boolean } | null}
 *   The matched export, or `null`
 */
export const matchBQueryCall = (context, call, sources, names) => {
  if (call.type !== 'CallExpression') return null;
  const resolved = resolveImported(context, call.callee, sources);
  return resolved && names.has(resolved.name) ? resolved : null;
};

/**
 * Evaluate an expression to a static string when that is possible without
 * running code: string literals, template literals without expressions,
 * `+` concatenations of those and `const` bindings initialised with them.
 *
 * @param {import('eslint').Rule.RuleContext} context - Rule context
 * @param {import('estree').Node} node - Expression to evaluate
 * @param {Set<import('estree').Node>} [seen] - Guards against cycles
 * @returns {boolean} True when the expression is a static string
 */
export const isStaticString = (context, node, seen = new Set()) => {
  if (!node || seen.has(node)) return false;
  seen.add(node);
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string';
    case 'TemplateLiteral':
      return node.expressions.length === 0;
    case 'BinaryExpression':
      return (
        node.operator === '+' &&
        isStaticString(context, node.left, seen) &&
        isStaticString(context, node.right, seen)
      );
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
      return isStaticString(context, node.expression, seen);
    case 'Identifier': {
      const variable = findVariable(context.sourceCode.getScope(node), node.name);
      const def = variable?.defs[0];
      if (
        !def ||
        variable.defs.length !== 1 ||
        def.type !== 'Variable' ||
        def.parent.kind !== 'const' ||
        def.node.id.type !== 'Identifier'
      ) {
        return false;
      }
      return isStaticString(context, def.node.init, seen);
    }
    default:
      return false;
  }
};
