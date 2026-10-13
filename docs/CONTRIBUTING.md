# Contributing

Use Node.js 20.9 or later and the committed npm lockfile:

```sh
npm ci
npm test -- --runInBand
npm run typecheck
npm run build
```

For local development, install [portless](https://github.com/vercel-labs/portless), then run:

```sh
portless proxy start
portless evolsim npm run dev
```

The default browser simulation uses seeded baseline policies and requires no API credentials. Optional provider configuration is documented in the [README](../README.md). Keep credentials outside Git and use mocked provider responses in automated tests; do not make paid calls as part of the test suite.

Include regression tests for changes to resource allocation, random-number isolation, observations, decision validation, or API limits. Reproduce policy experiments with `npm run benchmark -- /tmp/evolsim-baseline.json` and report the configuration, seed panel, source digest, and limitations alongside any results. Changed dynamics require regenerated results, not retained claims from an earlier protocol.

Keep TypeScript types and method documentation consistent with the implementation. In a pull request, describe the concrete behavior changed and the checks performed. For UI changes, verify Step, Play, Pause, Reset, preset selection, and narrow-screen layouts. Experimental prompts are part of the published method; private development notes and credentials are not.
