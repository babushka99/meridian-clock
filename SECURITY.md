# Security Policy

## Supported versions

Only the latest release receives fixes.

## Reporting a problem

Please **do not** open a public issue for a security problem.

Use GitHub's private reporting instead: go to the repository's **Security** tab →
**Report a vulnerability**. Include what you found, how to reproduce it, and which version you
tested. You should get a reply within 7 days.

## Design notes

The extension is built to have very little attack surface:

- one permission only (`storage`); no host permissions, no content scripts
- strict content security policy: `script-src 'self'`, `connect-src 'none'`, no inline script,
  no `eval`, no remote code
- no network access and no third-party services
