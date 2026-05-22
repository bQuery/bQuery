# Security Policy

Thank you for helping keep bQuery.js and its users safe. This document explains
which versions receive security updates, how to report a vulnerability
responsibly, and what you can expect from the maintainers in return.

## Supported versions

Security fixes are provided for the latest minor release line of bQuery.js. We
recommend that all users stay on the most recent published version.

| Version  | Supported          |
| -------- | ------------------ |
| 1.13.x   | :white_check_mark: |
| < 1.13.0 | :x:                |

Older versions may receive fixes at the maintainers' discretion if the issue is
severe and the backport is low risk. Please upgrade to the latest release
whenever possible.

## Supported runtimes

bQuery.js targets the following baseline runtimes. Vulnerabilities that only
reproduce on unsupported runtimes or browsers will be evaluated on a
best-effort basis.

- Node.js `>= 24.0.0`
- Bun `>= 1.3.13`
- Chrome 90+, Firefox 90+, Safari 15+, Edge 90+

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Instead, report them privately using one of the following channels:

1. **GitHub Security Advisories (preferred):** open a private report via
   [GitHub's "Report a vulnerability" workflow](https://github.com/bQuery/bQuery/security/advisories/new).
   This creates a confidential advisory that only the maintainers can see.
2. **Email:** if you cannot use GitHub Security Advisories, contact
   <support@josunlp.de> with the details described below.

To help us triage and reproduce the issue quickly, please include as much of
the following as you can:

- A clear description of the vulnerability and its impact.
- The affected bQuery.js version(s), module(s), and entry point(s) (for
  example `@bquery/bquery/core`, `@bquery/bquery/ssr`).
- The runtime and browser (or Node.js / Bun version) where the issue was
  observed.
- A minimal reproduction: code snippet, repository link, or step-by-step
  instructions.
- Any proof-of-concept payloads, stack traces, or logs that demonstrate the
  issue.
- Suggested remediation, if you have one.

If you would like your report to be treated as encrypted, mention this in your
initial message and we will coordinate a secure channel.

## Disclosure process

After a report is received, you can expect the following from the maintainers:

1. **Acknowledgement:** we aim to acknowledge new reports within **5 business
   days**.
2. **Triage:** we will validate the report, determine severity, and identify
   affected versions, typically within **10 business days** of acknowledgement.
3. **Fix and release:** we will develop a fix, prepare a patch release, and
   coordinate disclosure timing with you. For high-severity issues we aim to
   ship a fix within **30 days** of validation; lower-severity issues may take
   longer.
4. **Public advisory:** once a fix is available, we will publish a GitHub
   Security Advisory and release notes describing the issue, the affected
   versions, and the fix. With your permission, we will credit you in the
   advisory.

We follow a **coordinated disclosure** model. Please give us a reasonable
opportunity to investigate and remediate before publicly disclosing the
vulnerability or sharing details with third parties.

## Scope

In scope:

- Source code in this repository (`src/**`) and the published `@bquery/bquery`
  package on npm.
- Build outputs distributed via npm, unpkg, and jsDelivr.
- Documentation that, if exploited, could mislead users into insecure
  configurations (for example incorrect sanitization or CSP guidance).

Out of scope:

- Vulnerabilities in third-party applications that merely use bQuery.js.
- Issues that require already-compromised environments, physical access, or
  social engineering of maintainers or users.
- Theoretical issues without a demonstrable security impact on bQuery.js or
  its consumers.
- Denial-of-service issues that require providing untrusted input to APIs
  explicitly documented as accepting trusted input (for example the raw DOM
  escape hatches and the `view` module's `new Function()`-based templates,
  which already require trusted templates and an appropriate Content Security
  Policy).

## Security expectations for contributors

When contributing code, please follow the security guidance in
[`CONTRIBUTING.md`](./CONTRIBUTING.md) and the architectural notes in
[`AGENT.md`](./AGENT.md). In particular:

- HTML-writing APIs must sanitize untrusted content via `sanitizeHtml()`.
- Do not introduce new uses of `eval`, `new Function()`, or `document.write()`
  outside the documented `view` and `concurrency` exceptions.
- Escape user-controlled strings before HTML attribute insertion and respect
  Trusted Types where relevant.
- Add tests covering security-sensitive edge cases when changing
  sanitization, serialization, or DOM-derived data helpers.

Thank you for helping make bQuery.js safer for everyone.
