# Contributing

Thanks for considering a contribution. Improvements to gameplay, input handling, accessibility, browser support, documentation, and optional integrations are welcome.

## Before you start
1. Search existing issues and pull requests to avoid duplicate work.
2. For larger changes, open an issue first to discuss the approach.
3. Keep the front end framework-free unless a change has a clear, documented reason to add a dependency.
4. Do not commit uploaded user files, credentials, API keys, or production data.

## Development setup
- Node.js 20 or newer
- No install step is required for the front-end demo

```bash
npm run dev
npm run check
```

The local app is served at `http://127.0.0.1:4173`.

## Pull requests
- Keep each pull request focused and describe the user impact.
- Update documentation and `CHANGELOG.md` when behavior changes.
- Run `npm run check` before submitting.
- Test interaction changes in a browser and include a screenshot or short recording when useful.
- Explain any new dependency and keep it limited to the example or tooling that needs it.

By contributing, you agree that your contributions will be distributed under the project's MIT License.
