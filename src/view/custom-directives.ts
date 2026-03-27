import type { DirectiveHandler } from './types';

/**
 * Function signature used to resolve custom directives without coupling the
 * view pipeline directly to the plugin module.
 * @internal
 */
export type CustomDirectiveResolver = (name: string) => DirectiveHandler | undefined;

let customDirectiveResolver: CustomDirectiveResolver | null = null;

/**
 * Registers the resolver used by the view pipeline for custom directives.
 * @internal
 */
export const registerCustomDirectiveResolver = (
  resolver: CustomDirectiveResolver
): void => {
  customDirectiveResolver = resolver;
};

/**
 * Returns a custom directive handler when one is registered.
 * @internal
 */
export const getCustomDirective = (
  name: string
): DirectiveHandler | undefined => {
  return customDirectiveResolver ? customDirectiveResolver(name) : undefined;
};
