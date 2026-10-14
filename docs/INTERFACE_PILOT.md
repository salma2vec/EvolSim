# Action-interface pilot v1

The prior local Qwen 0.5B check produced zero valid decisions out of four completions. This protocol tests whether an observation-grounded JSON contract improves action validity. It does not test cooperation.

Run only with an existing local model, after committing source and protocol:

```bash
npx tsx scripts/research-interface.ts qwen2.5-coder:0.5b /tmp/evolsim-interface.json
```

The runner freezes eight initial observations: both species roles at seeds203,307,401,503 in `two_species_simple_lake`. The earlier diagnostic seeds11,42 are excluded. Each observation is sent to two arms in balanced order: the original prompt, and the original prompt with the exact visible-ID schema plus schema-constrained decoding. Both use the native local Ollama chat interface, temperature0, the same per-case sampling seed, context8192, at most1000generated tokens, a30-second timeout and no retries. The intervention is the complete grounding-and-decoding package; its parts are not identified separately.

The runner checks the installed model's digest and rejects cloud-backed models. It makes at most16 sequential loopback calls, downloads nothing and records full requests/responses, hashes, model metadata, source hashes, finish reasons and failures. Strict parsing remains unchanged. A provider failure counts in the denominator. Source must be clean and the output file must not already exist.

The primary result is valid/attempted per arm with paired improvements and regressions. A pilot passes its next-experiment gate only if the grounded arm has at least7/8valid decisions and strictly exceeds the control. Tests independently reject hidden-ID, malformed-number and out-of-range decisions. Empty harvest maps are counted to expose vacuous acceptance. Roles within each world are dependent: counts are descriptive, with no unsupported population confidence claim. Even8/8would establish only this small interface pilot.

Before strategy comparisons, require a fresh larger seed panel, repeated samples, ID-renaming controls and different stock/history states. Measure failure-inclusive semantic validity with uncertainty at the world/seed level. Only then evaluate multi-step stock/collapse outcomes against transparent partners with balanced roles. Do not interpret an invalid action as defection or a valid action as cooperation.

[Ollama's structured-output documentation](https://docs.ollama.com/capabilities/structured-outputs) describes schema grounding and constrained generation; semantic correctness is still checked by this project's parser. [GovSim](https://arxiv.org/abs/2404.16698) motivates the subsequent strategic question, but this pilot neither reproduces its experiments nor supports its conclusions.
