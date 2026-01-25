/**
 * Minimal Web Component helper for building custom elements.
 *
 * This module provides a declarative API for defining Web Components
 * without complex build steps. Features include:
 * - Type-safe props with automatic attribute coercion
 * - Reactive state management
 * - Shadow DOM encapsulation with scoped styles
 * - Lifecycle hooks (connected, disconnected)
 * - Event emission helpers
 *
 * @module bquery/component
 *
 * @example
 * ```ts
 * import { component, html } from 'bquery/component';
 *
 * component('user-card', {
 *   props: {
 *     username: { type: String, required: true },
 *     avatar: { type: String, default: '/default-avatar.png' },
 *   },
 *   styles: `
 *     .card { padding: 1rem; border: 1px solid #ccc; }
 *   `,
 *   render({ props }) {
 *     return html`
 *       <div class="card">
 *         <img src="${props.avatar}" alt="${props.username}" />
 *         <h3>${props.username}</h3>
 *       </div>
 *     `;
 *   },
 * });
 * ```
 */

export { component, defineComponent } from './component';
export { html, safeHtml } from './html';
export type { ComponentDefinition, ComponentRenderContext, PropDefinition } from './types';
