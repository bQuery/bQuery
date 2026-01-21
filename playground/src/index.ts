/**
 * bQuery Playground - Entry Point
 *
 * A modular playground demonstrating all bQuery capabilities.
 * The code is organized into separate modules for better readability:
 *
 * - state.ts         - Shared reactive state (theme, active section)
 * - components/      - Reusable UI components
 *   - foundation.ts  - Base components (button, input, code, cards)
 *   - navigation.ts  - Navigation bar
 *   - hero.ts        - Hero section
 *   - footer.ts      - Footer
 * - demos/           - Interactive demonstrations
 *   - core.ts        - DOM, CSS, events, collections
 *   - reactive.ts    - Signals, effects, batching
 *   - components.ts  - Component showcase
 *   - motion.ts      - FLIP, spring, transitions
 *   - security.ts    - Sanitization, trusted types
 *   - platform.ts    - Storage, notifications, theme
 * - app.ts           - Main application component
 */

// Import and register all components
import './app';

// Initialization
console.log(
  '%c🧩 bQuery.js Component-Based Playground',
  'color: #6366f1; font-weight: bold; font-size: 14px;'
);
console.log('%cEvery UI element is a bQuery Web Component!', 'color: #a855f7;');
console.log(
  '%cExplore all 6 modules: Core, Reactive, Components, Motion, Security, Platform',
  'color: #a1a1aa;'
);
console.log('%c📁 Code is modularized in playground/src/', 'color: #22c55e;');
