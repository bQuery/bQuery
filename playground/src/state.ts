/**
 * Shared State (Signals)
 * Global reactive state used across components
 */

import { persistedSignal, signal } from 'bquery';

// Theme state - persisted to localStorage
export const currentTheme = persistedSignal<'light' | 'dark' | 'system'>(
  'playground-theme',
  'dark'
);

// Active section for navigation
export const activeSection = signal('core');
