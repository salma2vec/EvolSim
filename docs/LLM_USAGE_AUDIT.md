# LLM Usage Audit

## Operational Protocol

To maintain benchmark integrity and avoid "black-box" drift, the following protocol is enforced for all models:

*   **Fixed Policy Generators**: Models are queried as stateless mapping functions: `Prompt -> Action`.
*   **Zero Learning**: No fine-tuning, RAG, or long-term memory is permitted across runs. Memory is strictly limited to the provided epoch history within the context window.
*   **Identical Prototyping**: All models receive identical prompt structures. The only variance is the specific `WorldState` snapshot they observe.
*   **No Self-Modification**: Models are prohibited from modifying their own prompts or system instructions.

## Model Capability Ladder

The benchmark evaluates models across three distinct reasoning tiers:

| Tier | Representative Models | Primary Research Purpose |
| :--- | :--- | :--- |
| **Baseline** | LLaMA-3 8B, Mistral 7B, Qwen 7B | Establish naïve cooperation and baseline strategic failure. |
| **Mid** | LLaMA-3 70B, Mixtral 8x7B, Qwen 32B | Measure emergence of strategic defection and treaty gaming. |
| **High** | DeepSeek-R1, GPT-4, o1, Claude 3.5 | Test if high-reasoning stabilizes or accelerates collapse. |

## Constraint Enforcement

### Pre-generation (Input)
- **Epistemic Filtering**: Observations are masked based on Order (0, 1, 2).
- **History Pruning**: History is limited to `historyLength` to prevent context bloat.
- **Linguistic Regime Injection**: System instructions explicitly define expression limits (LiteralOnly, etc.).

### Post-generation (Output)
- **Lex Enforcer**: Speech acts are stripped if the agent's `lexBudget` is insufficient.
- **Intent Validation**: Communication acts without a valid intent (`DESCRIBE`, `COMMIT`, etc.) are rejected.
- **Value Clamping**: Harvest requests are clamped to [0, 100] to prevent physical impossibility.

## Failure & Degradation Handling

- **Timeout**: 30s per epoch per agent.
- **Retries**: 2 attempts with exponential backoff.
- **Deterministic Fallback**: If a model fails to return valid JSON, it defaults to a minimal "survival" decision (idle harvest).
- **Log Signal**: All LLM failures are logged as `LLM_FAILURE` events and count toward the agent's "Cognitive Stability" metric.

## Configuration Surface

Models are assigned via the `speciesModelMap` in the simulation request:

```json
{
  "speciesModelMap": {
    "species_0": "deepseek-reasoner",
    "species_1": "llama-3-8b-instruct"
  }
}
```

## Verification Checklist

- [x] Results differ meaningfully between Baseline and High-tier models.
- [x] All models receive identical context window lengths.
- [x] Lex burn is tracked per model class.
- [x] Failure cases are dossiers for "Cognitive Collapse" analysis.
