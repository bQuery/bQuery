/**
 * Default component library based on native Web Components.
 *
 * @module bquery/component
 */

import { getBqueryConfig } from '../platform/config';
import { escapeHtml } from '../security';
import { component } from './component';
import { html } from './html';

/** Options for registering the default component library. */
export interface DefaultComponentLibraryOptions {
  /** Prefix used for all registered component tags. Defaults to `bq`. */
  prefix?: string;
}

/** Tag names returned by registerDefaultComponents(). */
export interface RegisteredDefaultComponents {
  /** Button component tag name. */
  button: string;
  /** Card component tag name. */
  card: string;
  /** Input component tag name. */
  input: string;
  /** Textarea component tag name. */
  textarea: string;
  /** Checkbox component tag name. */
  checkbox: string;
}

const baseStyles = `
  :host {
    color: inherit;
    font: inherit;
  }
`;

const controlStyles = `
  ${baseStyles}
  .field {
    display: inline-flex;
    flex-direction: column;
    gap: 0.375rem;
    width: 100%;
  }
  .label {
    color: #334155;
    font-size: 0.875rem;
    font-weight: 600;
  }
  .control {
    border: 1px solid #cbd5e1;
    border-radius: 0.75rem;
    box-sizing: border-box;
    font: inherit;
    min-height: 2.75rem;
    outline: none;
    padding: 0.75rem 0.875rem;
    width: 100%;
    background: #fff;
    color: #0f172a;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }
  .control:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
  }
  .control:disabled {
    background: #f8fafc;
    color: #94a3b8;
    cursor: not-allowed;
  }
`;

const escapeProp = (value: string): string => escapeHtml(value);

const handlerStore = new WeakMap<HTMLElement, Record<string, EventListener>>();

const readHandler = (element: HTMLElement, key: string): EventListener | undefined => {
  return handlerStore.get(element)?.[key];
};

const storeHandler = (element: HTMLElement, key: string, value: EventListener): void => {
  const handlers = handlerStore.get(element) ?? {};
  handlers[key] = value;
  handlerStore.set(element, handlers);
};

const getShadowLabelText = (element: HTMLElement): string => {
  return element.shadowRoot?.querySelector('.label')?.textContent ?? '';
};

/**
 * Detect a value-only input update, patch the live control in place, and
 * return whether the component can skip a full shadow DOM re-render.
 *
 * @param element - The host custom element whose shadow DOM is being updated
 * @param props - The next reflected input props for the pending update
 */
const canSkipInputRender = (
  element: HTMLElement,
  props: {
    label: string;
    type: string;
    value: string;
    placeholder: string;
    name: string;
    disabled: boolean;
  }
): boolean => {
  const control = element.shadowRoot?.querySelector('input.control') as HTMLInputElement | null;
  if (!control) return false;

  if (getShadowLabelText(element) !== props.label) return false;
  if ((control.getAttribute('type') ?? 'text') !== props.type) return false;
  if ((control.getAttribute('placeholder') ?? '') !== props.placeholder) return false;
  if ((control.getAttribute('name') ?? '') !== props.name) return false;
  if (control.disabled !== props.disabled) return false;

  if (control.value !== props.value) {
    control.value = props.value;
  }

  return true;
};

/**
 * Detect a value-only textarea update, patch the live control in place, and
 * return whether the component can skip a full shadow DOM re-render.
 *
 * @param element - The host custom element whose shadow DOM is being updated
 * @param props - The next reflected textarea props for the pending update
 */
const canSkipTextareaRender = (
  element: HTMLElement,
  props: {
    label: string;
    value: string;
    placeholder: string;
    name: string;
    rows: number;
    disabled: boolean;
  }
): boolean => {
  const control = element.shadowRoot?.querySelector(
    'textarea.control'
  ) as HTMLTextAreaElement | null;
  if (!control) return false;

  if (getShadowLabelText(element) !== props.label) return false;
  if ((control.getAttribute('placeholder') ?? '') !== props.placeholder) return false;
  if ((control.getAttribute('name') ?? '') !== props.name) return false;
  if (control.getAttribute('rows') !== String(props.rows)) return false;
  if (control.disabled !== props.disabled) return false;

  if (control.value !== props.value) {
    control.value = props.value;
  }
  return true;
};

const renderTextareaControl = (props: {
  value: string;
  placeholder: string;
  name: string;
  rows: number;
  disabled: boolean;
}): string => {
  return [
    '<textarea',
    ' part="control"',
    ' class="control"',
    ` placeholder="${escapeProp(props.placeholder)}"`,
    ` name="${escapeProp(props.name)}"`,
    ` rows="${props.rows}"`,
    props.disabled ? ' disabled' : '',
    `>${escapeProp(props.value)}</textarea>`,
  ].join('');
};

/**
 * Register a default set of foundational UI components.
 *
 * The library is intentionally small and dependency-free, providing common
 * primitives that can be themed via shadow parts and CSS custom properties.
 *
 * @param options - Optional registration settings such as a custom tag prefix
 * @returns The registered tag names for each component
 */
export const registerDefaultComponents = (
  options: DefaultComponentLibraryOptions = {}
): RegisteredDefaultComponents => {
  const prefix = options.prefix ?? getBqueryConfig().components?.prefix ?? 'bq';
  const tags: RegisteredDefaultComponents = {
    button: `${prefix}-button`,
    card: `${prefix}-card`,
    input: `${prefix}-input`,
    textarea: `${prefix}-textarea`,
    checkbox: `${prefix}-checkbox`,
  };

  component<{
    label: string;
    variant: string;
    size: string;
    type: string;
    disabled: boolean;
  }>(tags.button, {
    props: {
      label: { type: String, default: '' },
      variant: { type: String, default: 'primary' },
      size: { type: String, default: 'md' },
      type: { type: String, default: 'button' },
      disabled: { type: Boolean, default: false },
    },
    styles: `
      ${baseStyles}
      button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font: inherit;
        font-weight: 600;
        gap: 0.5rem;
        min-height: 2.5rem;
        padding: 0.65rem 1rem;
        transition: transform 160ms ease, opacity 160ms ease, background 160ms ease;
        background: #2563eb;
        color: #fff;
      }
      button[data-variant='secondary'] {
        background: #e2e8f0;
        color: #0f172a;
      }
      button[data-size='sm'] {
        min-height: 2.125rem;
        padding: 0.5rem 0.875rem;
      }
      button[data-size='lg'] {
        min-height: 3rem;
        padding: 0.875rem 1.25rem;
      }
      button:hover:not(:disabled) {
        transform: translateY(-1px);
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
    `,
    render: ({ props }) => html`
      <button
        part="button"
        type="${escapeProp(props.type)}"
        data-variant="${escapeProp(props.variant)}"
        data-size="${escapeProp(props.size)}"
        ${props.disabled ? 'disabled' : ''}
      >
        <slot>${escapeProp(props.label)}</slot>
      </button>
    `,
  });

  component<{ title: string; footer: string; elevated: boolean }>(tags.card, {
    props: {
      title: { type: String, default: '' },
      footer: { type: String, default: '' },
      elevated: { type: Boolean, default: true },
    },
    styles: `
      ${baseStyles}
      article {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 1rem;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
        color: #0f172a;
        display: block;
        padding: 1rem;
      }
      article[data-elevated='false'] {
        box-shadow: none;
      }
      header, footer {
        color: #475569;
        font-size: 0.95rem;
        font-weight: 600;
      }
      header {
        margin-bottom: 0.75rem;
      }
      footer {
        margin-top: 0.75rem;
      }
    `,
    render: ({ props }) => html`
      <article part="card" data-elevated="${String(props.elevated)}">
        ${props.title ? `<header part="header">${escapeProp(props.title)}</header>` : ''}
        <section part="body"><slot></slot></section>
        ${props.footer ? `<footer part="footer">${escapeProp(props.footer)}</footer>` : ''}
      </article>
    `,
  });

  component<{
    label: string;
    type: string;
    value: string;
    placeholder: string;
    name: string;
    disabled: boolean;
  }>(tags.input, {
    props: {
      label: { type: String, default: '' },
      type: { type: String, default: 'text' },
      value: { type: String, default: '' },
      placeholder: { type: String, default: '' },
      name: { type: String, default: '' },
      disabled: { type: Boolean, default: false },
    },
    styles: controlStyles,
    /**
     * Skip the full shadow DOM re-render when only the reflected input value
     * changed, because the live control has already been patched in place.
     */
    beforeUpdate(props) {
      if (canSkipInputRender(this, props)) {
        return false;
      }
      return true;
    },
    connected() {
      const handleInput = (event: Event) => {
        const target = event.target as HTMLInputElement | null;
        if (!target?.matches('input')) return;
        event.stopPropagation();
        this.setAttribute('value', target.value);
        this.dispatchEvent(
          new CustomEvent('input', {
            detail: { value: target.value },
            bubbles: true,
            composed: true,
          })
        );
      };
      storeHandler(this, '__bqueryInputHandler', handleInput);
      this.shadowRoot?.addEventListener('input', handleInput);
    },
    disconnected() {
      const handleInput = readHandler(this, '__bqueryInputHandler');
      if (handleInput) {
        this.shadowRoot?.removeEventListener('input', handleInput);
      }
    },
    render: ({ props }) => html`
      <label part="field" class="field">
        ${props.label ? `<span part="label" class="label">${escapeProp(props.label)}</span>` : ''}
        <input
          part="control"
          class="control"
          type="${escapeProp(props.type)}"
          value="${escapeProp(props.value)}"
          placeholder="${escapeProp(props.placeholder)}"
          name="${escapeProp(props.name)}"
          ${props.disabled ? 'disabled' : ''}
        />
      </label>
    `,
  });

  component<{
    label: string;
    value: string;
    placeholder: string;
    name: string;
    rows: number;
    disabled: boolean;
  }>(tags.textarea, {
    props: {
      label: { type: String, default: '' },
      value: { type: String, default: '' },
      placeholder: { type: String, default: '' },
      name: { type: String, default: '' },
      rows: { type: Number, default: 4 },
      disabled: { type: Boolean, default: false },
    },
    styles: `${controlStyles}
      textarea.control {
        min-height: 6rem;
        resize: vertical;
      }
    `,
    /**
     * Skip the full shadow DOM re-render when only the reflected textarea value
     * changed, because the live control has already been patched in place.
     */
    beforeUpdate(props) {
      if (canSkipTextareaRender(this, props)) {
        return false;
      }
      return true;
    },
    connected() {
      const handleInput = (event: Event) => {
        const target = event.target as HTMLTextAreaElement | null;
        if (!target?.matches('textarea')) return;
        event.stopPropagation();
        this.setAttribute('value', target.value);
        this.dispatchEvent(
          new CustomEvent('input', {
            detail: { value: target.value },
            bubbles: true,
            composed: true,
          })
        );
      };
      storeHandler(this, '__bqueryTextareaHandler', handleInput);
      this.shadowRoot?.addEventListener('input', handleInput);
    },
    disconnected() {
      const handleInput = readHandler(this, '__bqueryTextareaHandler');
      if (handleInput) {
        this.shadowRoot?.removeEventListener('input', handleInput);
      }
    },
    render: ({ props }) => html`
      <label part="field" class="field">
        ${props.label ? `<span part="label" class="label">${escapeProp(props.label)}</span>` : ''}
        ${renderTextareaControl(props)}
      </label>
    `,
  });

  component<{ label: string; checked: boolean; disabled: boolean }>(tags.checkbox, {
    props: {
      label: { type: String, default: '' },
      checked: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
    },
    styles: `
      ${baseStyles}
      label {
        align-items: center;
        color: #0f172a;
        cursor: pointer;
        display: inline-flex;
        gap: 0.625rem;
      }
      input {
        accent-color: #2563eb;
        block-size: 1rem;
        inline-size: 1rem;
      }
      input:disabled {
        cursor: not-allowed;
      }
    `,
    connected() {
      const handleChange = (event: Event) => {
        const target = event.target as HTMLInputElement | null;
        if (!target?.matches('input[type="checkbox"]')) return;
        event.stopPropagation();
        if (target.checked) {
          this.setAttribute('checked', 'true');
        } else {
          this.removeAttribute('checked');
        }
        this.dispatchEvent(
          new CustomEvent('change', {
            detail: { checked: target.checked },
            bubbles: true,
            composed: true,
          })
        );
      };
      storeHandler(this, '__bqueryCheckboxHandler', handleChange);
      this.shadowRoot?.addEventListener('change', handleChange);
    },
    disconnected() {
      const handleChange = readHandler(this, '__bqueryCheckboxHandler');
      if (handleChange) {
        this.shadowRoot?.removeEventListener('change', handleChange);
      }
    },
    render: ({ props }) => html`
      <label part="label">
        <input
          part="control"
          type="checkbox"
          ${props.checked ? 'checked' : ''}
          ${props.disabled ? 'disabled' : ''}
        />
        <span part="text"><slot>${escapeProp(props.label)}</slot></span>
      </label>
    `,
  });

  return tags;
};
