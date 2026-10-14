# The Third Pillar

A reproducible multi-agent commons simulator for investigating resource competition, restricted observations, and language-mediated institutions. Agents choose harvest requests, relations, governance parameters, and optional treaty proposals in a toy ecology.

The working release runs four transparent baseline policies without API keys and includes a browser instrument panel, seeded batch runner, raw trajectories, and regression tests. **It does not establish any ranking or scaling law for LLMs.** The live OpenAI adapter is opt-in; no live model evaluation is included in the reported baseline experiment.

## Run locally

Node.js 22.12+:

```bash
npm ci
npm test
npm run typecheck
npm run build
portless proxy start -p 1355
portless evolsim npm run dev
```

Open the URL printed by portless. Step advances a deterministic baseline trajectory, Play repeats steps, Reset starts over, and Export downloads the state history. The UI uses seed 12345. Since each Step reruns the increasing horizon, it is intended for short exploratory trajectories (maximum 200 steps); use the batch runner for experiments.

The Tailwind 4 interface targets Safari 16.4+, Chrome 111+, and Firefox 128+ ([browser requirements](https://tailwindcss.com/docs/upgrade-guide#browser-requirements)). Run `npm audit --audit-level=low` to check the complete installed dependency tree; CI includes development dependencies in this check.

## Reproduce a baseline comparison

```bash
npm run benchmark -- results/baseline.json
```

The runner compares cooperative, defector, conservative, and opportunistic policies on the same five seeds (11, 23, 42, 71, 101), with 100 requested steps in `two_species_simple_lake`. Harvest noise is zero; seeded environmental shocks remain enabled. The output contains the complete trajectories, applied configuration, protocol version, source digest, trajectory hashes, per-run collapse times, and a descriptive summary.

The checked-in [baseline summary](results/baseline-summary.json) records the following local run (protocol 2.1.0):

| Policy | Resource collapses by 100 steps | Mean final stock |
| --- | --- | --- |
| Cooperative | 1/5 | 47.389 |
| Defector | 5/5 | 0.000 |
| Conservative | 0/5 | 86.019 |
| Opportunistic | 0/5 | 55.209 |

The paired-seed design controls initial conditions. Five seeds are a demonstration, not sufficient evidence for a general social-science or model-capability conclusion. A non-collapsing trajectory is right-censored at the evaluation horizon; it must not be recorded as a collapse at step 100. Baselines do not communicate or propose treaties, so this experiment does not validate the institutional mechanisms.

## Check a locally installed model

With Ollama already running, choose an installed model that fits your machine's available memory. Replace `YOUR_INSTALLED_MODEL` below with its exact tag:

```bash
npm run validate:local -- YOUR_INSTALLED_MODEL /tmp/evolsim-local.json --check
npm run validate:local -- YOUR_INSTALLED_MODEL /tmp/evolsim-local.json
```

The first command checks local model metadata without inference. The second attempts two one-step, two-species runs (simulation seeds 11 and 42), with at most four model calls. It pins the endpoint to `127.0.0.1:11434`, rejects cloud-backed models, downloads nothing, and records model digest, Ollama version, raw request/response bodies, usage returned by the server, timings, failures, and successful trajectories. It uses the existing adapter with Ollama's [documented compatibility interface](https://docs.ollama.com/api/openai-compatibility) and `max_tokens` field; the 30-second timeout and 1,000-token request budget remain in effect. Failed runs are preserved and produce a nonzero exit status.

Temperature and model-sampling seed are omitted, matching the default adapter. **The simulator seeds do not make these model responses reproducible.** This is a small compatibility check, not a cooperation benchmark or a model ranking. The complete artifact can be large and contains experiment prompts; choose its output location deliberately.

The [recorded local check](results/local-validation-summary.json) used Qwen2.5-Coder 0.5B (Q4_K_M): four HTTP completions, but **zero of four decisions passed semantic validation** on offline replay. One initially completed step used invented resource/species IDs; this exposed a parser defect, which is now fixed. The apparent completion is invalidated. Live decisions now reject unknown or hidden IDs, invalid targets, numeric ranges, action fields and malformed communication before the simulator applies actions. Valid zero governance and communication survive normalization. Protocol 2.1.0 records this changed action contract; the fixed-policy control trajectories remain unchanged.

To recheck a saved local transcript against the current parser without new inference:

```bash
npm run replay:local -- /tmp/evolsim-local.json /tmp/evolsim-local-replay.json
```

## What is implemented

- Logistic resource growth, irreversible collapse, proportional allocation under scarcity, and population/stress dynamics.
- Explicit action schedules and visibility rules, with ablation switches.
- A typed action boundary and a literal/anchored treaty-language parser.
- Seeded random numbers scoped to individual server experiments, including concurrent runs.
- A shared runner for single and batch experiments; failures do not become synthetic model decisions.

The simulator is not an ecological model fitted to observations. Population dynamics, permissions, noise scales, and language rules are design choices. The supported interpretation is behavior **inside these specified rules**, not evidence about human societies or real ecosystems.

## API and compute limits

`POST /api/simulate` accepts `presetId`, integer `numSteps` (1–200), `seed`, and optional validated `config`. Baseline policies are the default. `POST /api/batch` supports up to 20 baseline runs and 1,000 aggregate steps, with explicit seeds. Both return raw histories. Missing seeds default to 42 (batch: 42 plus run index).

```json
{
  "presetId": "two_species_simple_lake",
  "numSteps": 100,
  "seed": 42,
  "config": {
    "useBaselineAgents": true,
    "harvestNoise": 0,
    "baselinePolicyMap": {"species_0": "cooperative", "species_1": "defector"}
  }
}
```

For live calls set server-only `EVOLSIM_ENABLE_LLM=true`, `OPENAI_API_KEY`, an `EVOLSIM_API_TOKEN` of at least 32 characters, and `EVOLSIM_MODELS` containing an explicit comma-separated allowlist of exact provider model IDs. Send `Authorization: Bearer <token>`, `config.useBaselineAgents=false`, and an exact `speciesModelMap` for every species. There are no capability aliases or automatic substitutions. Provider errors, malformed decisions, and truncated responses fail the experiment. Each call has a 30-second timeout, no automatic retry, and a 1,000-token output default; a live simulation is limited to 100 potential decision calls.

When `EVOLSIM_API_TOKEN` is set, all simulation APIs require it. The baseline browser UI does not store or send credentials; use an authenticated API client for protected runs. The API limits are per process, not a deployment-wide billing quota. Keep development servers local; any public deployment needs a gateway with authentication, rate limits, durable usage budgets, and a provider spending cap. No deployment is supplied here.

Browser API requests must originate from the same origin as the application; foreign origins, opaque origins and cross-site requests are rejected before computation. Non-browser API clients continue to use the bearer-token contract above. Portless supplies the public origin through `PORTLESS_URL`; other reverse proxies must set server-only `EVOLSIM_PUBLIC_ORIGIN` to the application's exact public origin. Forwarded request headers cannot select a trusted origin.

Protocol 2.1.1 applies the visibility boundary to event history, memory summaries, living-simile references and treaty validation as well as primary observations. References now record their resource identifier; legacy references without that provenance are excluded from restricted observations. The archived baseline and local-model reports retain their original protocol versions.

## Methods and references

- [Evaluation protocol and metric definitions](docs/EVALUATION_SURFACE.md)
- [State, dynamics and limitations](docs/SCIENTIFIC_OBJECT.md)
- [LLM operational protocol](docs/LLM_USAGE_AUDIT.md)
- [Related work](docs/POSITIONING.md)
- [Architecture](docs/ARCHITECTURE.md)

The experimental prompt in `lib/llm/promptBuilder.ts` is part of the public method and intentionally versioned. See the method documents for the distinction between verified baseline execution, exploratory metrics, and untested live-model hypotheses.

License: ISC.
