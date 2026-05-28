# Security Policy

The canonical security policy is [`SECURITY.md`](https://github.com/bQuery/bQuery/blob/main/SECURITY.md) at the repository root. This page summarises it.

## Reporting a vulnerability

**Do not** open a public GitHub issue for a suspected vulnerability. Follow the disclosure path documented in [`SECURITY.md`](https://github.com/bQuery/bQuery/blob/main/SECURITY.md).

## Scope

Security reports about any of the following are in scope:

- The published `@bquery/bquery` package.
- The runnable examples under `examples/`.
- The documentation site at `https://bquery.js.org` (this site).

## Out of scope

- Vulnerabilities in third-party dependencies — please report them upstream.
- Issues that require the attacker to already control the page that imports bQuery.
- Issues that depend on browsers older than the documented [browser baseline](/concepts/runtimes).

## Hardening defaults

For a tour of what bQuery does to keep you safe by default — sanitization, Trusted Types, server input validation, body size limits — see the [Security Model](/concepts/security-model) concept page and the [Security module guide](/guide/security).

## See also

- [Security Model](/concepts/security-model)
- [Security module guide](/guide/security)
- [Code of Conduct](/contributing/code-of-conduct)
