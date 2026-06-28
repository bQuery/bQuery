/**
 * Development-time accessibility audit utility.
 *
 * Scans DOM elements for common accessibility issues such as missing
 * alt text on images, missing labels on form inputs, empty links/buttons,
 * and incorrect ARIA usage.
 *
 * @module bquery/a11y
 */

import type { AuditFinding, AuditResult, AuditRule, AuditSeverity } from './types';

/**
 * The complete, frozen catalog of rules the runtime audit checks, each mapped
 * to a WCAG 2.1 success criterion and annotated with what it **cannot** detect.
 *
 * This is the audit's documented scope. The runtime audit catches structural,
 * statically-determinable issues only; it does **not** evaluate colour
 * contrast, focus order, reading order, motion, timing, or any criterion that
 * requires rendering, computed styles, or human judgement. Treat it as a fast
 * development signal, never as a substitute for a manual or professional audit.
 *
 * @see {@link auditA11y}
 */
export const auditRules: readonly AuditRule[] = [
  {
    rule: 'img-alt',
    wcag: '1.1.1',
    severity: 'error',
    description: 'Images expose an `alt` attribute.',
    cannotDetect: 'Whether the alt text is accurate or meaningful.',
  },
  {
    rule: 'img-decorative',
    wcag: '1.1.1',
    severity: 'info',
    description: 'Empty-alt images are flagged as possibly decorative.',
    cannotDetect: 'Whether the image is genuinely decorative.',
  },
  {
    rule: 'input-label',
    wcag: '4.1.2',
    severity: 'error',
    description:
      'Form controls have an accessible name (`<label>`, wrapping label, `aria-label`/`aria-labelledby`, or `title`).',
    cannotDetect: 'Whether the label text is descriptive or correct.',
  },
  {
    rule: 'button-name',
    wcag: '4.1.2',
    severity: 'error',
    description: 'Buttons have an accessible name (text, `aria-label`, or `title`).',
    cannotDetect: 'Whether the name communicates the action.',
  },
  {
    rule: 'link-name',
    wcag: '2.4.4',
    severity: 'error',
    description: 'Links have an accessible name (text, labelled image, `aria-label`, or `title`).',
    cannotDetect: 'Whether the link purpose is clear from its name or context.',
  },
  {
    rule: 'heading-order',
    wcag: '1.3.1',
    severity: 'warning',
    description: 'Heading levels are not skipped (e.g. `<h2>` → `<h4>`).',
    cannotDetect: 'Whether headings reflect the true document outline.',
  },
  {
    rule: 'heading-empty',
    wcag: '1.3.1',
    severity: 'warning',
    description: 'Headings are not empty.',
    cannotDetect: 'Whether heading text is meaningful.',
  },
  {
    rule: 'aria-labelledby-ref',
    wcag: '4.1.2',
    severity: 'error',
    description: '`aria-labelledby` references resolve to elements in the document.',
    cannotDetect: 'References inside other shadow roots or not yet rendered.',
  },
  {
    rule: 'aria-describedby-ref',
    wcag: '4.1.2',
    severity: 'error',
    description: '`aria-describedby` references resolve to elements in the document.',
    cannotDetect: 'References inside other shadow roots or not yet rendered.',
  },
  {
    rule: 'landmark-main',
    wcag: '1.3.1',
    severity: 'warning',
    description: 'The page exposes a `<main>` (or `role="main"`) landmark.',
    cannotDetect: 'Whether other landmarks (nav, banner, contentinfo) are correct.',
  },
];

/** WCAG lookup keyed by rule id, derived from {@link auditRules}. @internal */
const WCAG_BY_RULE: Record<string, string> = Object.fromEntries(
  auditRules.map((r) => [r.rule, r.wcag])
);

/**
 * Creates a finding object, stamping the WCAG criterion from {@link auditRules}.
 * @internal
 */
const finding = (
  severity: AuditSeverity,
  message: string,
  element: Element,
  rule: string
): AuditFinding => ({
  severity,
  message,
  element,
  rule,
  wcag: WCAG_BY_RULE[rule] ?? '',
});

/**
 * Checks images for missing alt attributes.
 * @internal
 */
const auditImages = (container: Element): AuditFinding[] => {
  const findings: AuditFinding[] = [];
  const images = container.querySelectorAll('img');

  for (const img of images) {
    if (!img.hasAttribute('alt')) {
      findings.push(
        finding(
          'error',
          'Image is missing an alt attribute. Add alt="" for decorative images or a descriptive alt text.',
          img,
          'img-alt'
        )
      );
    } else if (img.getAttribute('alt') === '' && !img.hasAttribute('role')) {
      findings.push(
        finding(
          'info',
          'Image has empty alt text. Consider adding role="presentation" if decorative.',
          img,
          'img-decorative'
        )
      );
    }
  }

  return findings;
};

/**
 * Checks form inputs for missing labels.
 * @internal
 */
const auditFormInputs = (container: Element): AuditFinding[] => {
  const findings: AuditFinding[] = [];
  const inputs = container.querySelectorAll('input, select, textarea');

  for (const input of inputs) {
    const type = input.getAttribute('type');

    // Hidden, submit, and button inputs don't need labels
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset') {
      continue;
    }

    const id = input.getAttribute('id');
    const hasLabel = id ? !!container.querySelector(`label[for="${id}"]`) : false;
    const hasAriaLabel = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby');
    const hasTitle = input.hasAttribute('title');
    const isWrappedInLabel = input.closest('label') !== null;

    if (!hasLabel && !hasAriaLabel && !hasTitle && !isWrappedInLabel) {
      findings.push(
        finding(
          'error',
          `Form input is missing a label. Add a <label for="id">, aria-label, or aria-labelledby attribute.`,
          input,
          'input-label'
        )
      );
    }
  }

  return findings;
};

/**
 * Checks for empty interactive elements (buttons, links).
 * @internal
 */
const auditInteractiveElements = (container: Element): AuditFinding[] => {
  const findings: AuditFinding[] = [];

  // Check buttons
  const buttons = container.querySelectorAll('button');
  for (const btn of buttons) {
    const hasText = (btn.textContent ?? '').trim().length > 0;
    const hasAriaLabel = btn.hasAttribute('aria-label') || btn.hasAttribute('aria-labelledby');
    const hasTitle = btn.hasAttribute('title');

    if (!hasText && !hasAriaLabel && !hasTitle) {
      findings.push(
        finding(
          'error',
          'Button has no accessible name. Add text content, aria-label, or title.',
          btn,
          'button-name'
        )
      );
    }
  }

  // Check links
  const links = container.querySelectorAll('a[href]');
  for (const link of links) {
    const hasText = (link.textContent ?? '').trim().length > 0;
    const hasAriaLabel = link.hasAttribute('aria-label') || link.hasAttribute('aria-labelledby');
    const hasTitle = link.hasAttribute('title');
    const hasImage = link.querySelector('img[alt]') !== null;

    if (!hasText && !hasAriaLabel && !hasTitle && !hasImage) {
      findings.push(
        finding(
          'error',
          'Link has no accessible name. Add text content, aria-label, or title.',
          link,
          'link-name'
        )
      );
    }
  }

  return findings;
};

/**
 * Checks heading hierarchy for skipped levels.
 * @internal
 */
const auditHeadings = (container: Element): AuditFinding[] => {
  const findings: AuditFinding[] = [];
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');

  let previousLevel = 0;

  for (const heading of headings) {
    const level = parseInt(heading.tagName.charAt(1), 10);

    if (previousLevel > 0 && level > previousLevel + 1) {
      findings.push(
        finding(
          'warning',
          `Heading level skipped: <${heading.tagName.toLowerCase()}> follows <h${previousLevel}>. Don't skip heading levels.`,
          heading,
          'heading-order'
        )
      );
    }

    if ((heading.textContent ?? '').trim().length === 0) {
      findings.push(finding('warning', 'Heading element is empty.', heading, 'heading-empty'));
    }

    previousLevel = level;
  }

  return findings;
};

/**
 * Checks for valid ARIA attribute usage.
 * @internal
 */
const auditAria = (container: Element): AuditFinding[] => {
  const findings: AuditFinding[] = [];

  // Check aria-labelledby references exist
  const labelled = container.querySelectorAll('[aria-labelledby]');
  for (const el of labelled) {
    const ids = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/);
    for (const id of ids) {
      if (id && !document.getElementById(id)) {
        findings.push(
          finding(
            'error',
            `aria-labelledby references "${id}" which does not exist in the document.`,
            el,
            'aria-labelledby-ref'
          )
        );
      }
    }
  }

  // Check aria-describedby references exist
  const described = container.querySelectorAll('[aria-describedby]');
  for (const el of described) {
    const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/);
    for (const id of ids) {
      if (id && !document.getElementById(id)) {
        findings.push(
          finding(
            'error',
            `aria-describedby references "${id}" which does not exist in the document.`,
            el,
            'aria-describedby-ref'
          )
        );
      }
    }
  }

  return findings;
};

/**
 * Checks for sufficient document landmarks.
 * @internal
 */
const auditLandmarks = (container: Element): AuditFinding[] => {
  const findings: AuditFinding[] = [];

  // Only audit the document body or top-level container
  if (container === document.body || container === document.documentElement) {
    const hasMain = !!container.querySelector('main') || !!container.querySelector('[role="main"]');

    if (!hasMain) {
      findings.push(
        finding(
          'warning',
          'Page is missing a <main> landmark. Add <main> or role="main" to the primary content area.',
          container,
          'landmark-main'
        )
      );
    }
  }

  return findings;
};

/**
 * Runs a development-time accessibility audit on a container element.
 *
 * Checks for common accessibility issues including:
 * - Missing alt text on images
 * - Missing labels on form inputs
 * - Empty buttons and links
 * - Heading hierarchy issues
 * - Invalid ARIA references
 * - Missing document landmarks
 *
 * This is intended as a development tool — not a replacement for
 * manual testing or professional accessibility audits.
 *
 * @param container - The element to audit (defaults to `document.body`)
 * @returns An audit result with findings, counts, and pass/fail status
 *
 * @example
 * ```ts
 * import { auditA11y } from '@bquery/bquery/a11y';
 *
 * const result = auditA11y();
 * if (!result.passed) {
 *   console.warn(`Found ${result.errors} accessibility errors:`);
 *   for (const f of result.findings) {
 *     console.warn(`[${f.severity}] ${f.message}`, f.element);
 *   }
 * }
 * ```
 */
export const auditA11y = (container?: Element): AuditResult => {
  if (typeof document === 'undefined' || !document.body) {
    return {
      findings: [],
      errors: 0,
      warnings: 0,
      passed: true,
    };
  }

  const target = container ?? document.body;

  const allFindings: AuditFinding[] = [
    ...auditImages(target),
    ...auditFormInputs(target),
    ...auditInteractiveElements(target),
    ...auditHeadings(target),
    ...auditAria(target),
    ...auditLandmarks(target),
  ];

  const errors = allFindings.filter((f) => f.severity === 'error').length;
  const warnings = allFindings.filter((f) => f.severity === 'warning').length;

  return {
    findings: allFindings,
    errors,
    warnings,
    passed: errors === 0,
  };
};
