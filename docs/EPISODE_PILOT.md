# Multi-step local episode pilot v1

This is a functional follow-up to the paired action-interface pilot. It tests whether schema-grounded model actions advance the actual simulator across changing observations. It is not a cooperation evaluation.

Use the already installed model after committing source/protocol:

```bash
npx tsx scripts/research-episodes.ts qwen2.5-coder:0.5b /tmp/evolsim-episodes.json
```

Two fresh world seeds607,709, both species roles, four requested steps per episode. Compare original and grounded-schema arms on each seed, with arm order balanced across seeds. Each episode stops at the first provider/semantic failure. No retries, repair, fallback or cherry-picked replacement seeds. At most32 calls are possible across all four episodes. Both arms use the same local OpenAI-compatible adapter, temperature0, sampling seed equal to the world seed, the installed server's context default, a1000-token output budget and30-second timeout. No downloads or cloud model calls.

`config.useStructuredDecisions=true` adds an observation-grounded schema to the prompt and provider request. It defaults tofalse. `llmTemperature` and `llmSeed` are optional validated configuration fields. Unsupported provider schema features fail normally; the strict parser remains authoritative. Protocol2.2.0 records this optional action-interface extension. Sampling seeds request reproducibility, not guarantee it.

Save every request/response, model/source metadata and both full and failed partial trajectories. The runner uses the existing `runSimulation` path; its optional local observer receives a clone after each validated state so a failed later action cannot erase prior completed steps. No state is advanced for an invalid decision batch.

Primary functional gate: both grounded episodes complete all four steps with finite valid state, with no semantically repaired actions. Report completed steps, decision-call counts, and failures for all four episodes. Initial-world rows do not count as completed steps. The gate is intentionally stronger than merely receiving valid JSON. Failure is retained and means multi-step recovery remains incomplete.

Resource stocks and collapse are descriptive diagnostics. Two worlds, one model and four ticks cannot establish sustainability, institutional benefit, model ranking or a powered intervention effect. Do not pool these episodes with the earlier eight-observation pilot: endpoint, context and sampling settings differ. Promotion to strategic evaluation still requires the larger protocol in [INTERFACE_PILOT.md](INTERFACE_PILOT.md).

The recorder checks the service-reported model digest before each episode and after the run. This establishes reported continuity, not authenticated model attestation. Provider usage and model parameters are retained. No equality check against a native full-prompt tokenizer is performed: context completeness is unverified, and the endpoint uses the server context default. These limits apply even when an episode completes.
