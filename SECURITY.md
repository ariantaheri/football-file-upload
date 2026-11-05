# Security policy

## Supported versions

Security fixes are applied to the latest version on the default branch. There are no formal long-term support branches at this stage.

## Reporting a vulnerability

Please do not publish exploitable vulnerabilities in a public issue. Use GitHub's **Report a vulnerability** option under the repository's Security tab when it is available. Include reproduction steps, impact, and any relevant logs without sharing real users' files or secrets.

## File-upload deployment guidance

The included front end is a demo, not a security boundary. The optional Express example is for local integration and must be hardened before production use.

At minimum, a production upload service should:

- Authenticate and authorize upload requests.
- Enforce size limits and request limits on the server.
- Validate file content using an allowlist appropriate to the product; do not trust extensions or client MIME types.
- Generate storage keys on the server instead of using uploaded filenames as paths.
- Keep uploaded files outside public web roots and use private storage by default.
- Consider malware scanning, rate limiting, quotas, retention, deletion, and audit logging.
- Restrict CORS to trusted origins and protect cookie-authenticated endpoints against CSRF.
- Keep dependencies patched and monitor security advisories.

The demo's default mode does not transmit or store selected files. A configured endpoint receives the selected file after a goal is scored.
