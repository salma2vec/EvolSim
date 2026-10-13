# Architecture

The browser is an instrument panel for bounded baseline trajectories. `WorldControls` submits an increasing horizon with a fixed seed and displays the returned full history. Playback is a sequence of requests, and Reset invalidates an outstanding response. Export is browser-local.

`lib/server/simulation.ts` is the shared execution path. It validates workload/configuration, creates an asynchronous random-number context, instantiates the preset, collects decisions for the currently acting species, advances the world, validates the new state and records a trajectory digest. Single and batch APIs use this same path. Batches are baseline-only.

`lib/sim` contains state types, generation, random numbers, visibility/language mechanics, allocation, resource/population dynamics, guards and derived metrics. Explicit baseline policies consume observations. `lib/llm` builds the experimental prompt, makes opt-in provider calls and parses bounded decisions. Failures abort live runs; they never become successful mock trajectories.

API boundaries enforce a streamed body-size limit, bounded steps/runs, optional server authentication for baseline runs and mandatory authentication for live calls. Provider model IDs must be explicitly configured. Concurrency limits are per process; deployment-wide rate limiting and durable cost budgets belong in a separate gateway.

`npm run benchmark` writes a source digest, applied configs, raw histories, hashes and descriptive summaries. `tests/lib/server/simulation.test.ts` covers seeded repeatability, concurrent isolation, all presets, zero-supply allocation, provider non-use in baselines, authentication, malformed inputs and failure propagation.

See [the evaluation protocol](EVALUATION_SURFACE.md) for which metrics are supported outcomes and which remain exploratory.
