# LLM Usage Audit

## For Each Agent

### Model Assignment
- **Location**: `SpeciesState.policyBrainId`
- **Default**: "small" (GPT-3.5-turbo)
- **Configurable**: Via `speciesModelMap` in simulation request
- **Swappable**: Yes, via config without code changes

### Context Window
- **Observation**: Filtered by `InformationState` (epistemic order)
- **History**: Last K epochs (configurable via `historyLength`)
- **Memory**: Summarized for long-interval orders
- **Size**: ~2000-5000 tokens per prompt (estimated)

### Constraints Enforced

**Pre-generation:**
- Linguistic regime constraints in prompt
- Epistemic order constraints in prompt
- Observation bandwidth filtering
- Memory summarization for long-interval orders

**Post-generation:**
- Schema validation (`parseLLMResponse`)
- Value clamping (harvest 0-100, governance 0-1)
- Treaty text validation (`validateTreatyText`)
- Parse-time rejection for invalid linguistic regimes

### Temperature / Randomness
- **Current**: Not explicitly controlled (uses API defaults)
- **Effect**: Model randomness affects outcomes
- **Baseline comparison**: Baseline agents are deterministic

### Failure Handling
- **Timeout**: 30s per request
- **Retries**: 2 attempts with exponential backoff
- **Fallback**: Deterministic minimal decision
- **Logging**: All failures logged as events

## Model Capability Comparison

**To verify results change meaningfully:**
1. Run same config with different models
2. Compare metrics (cooperation index, collapse time, welfare)
3. Verify divergence is significant (not noise)

**Baseline policies for comparison:**
- `cooperative`: Always sustainable harvest
- `defector`: Always over-harvest
- `conservative`: Always low harvest
- `opportunistic`: Harvest based on resource availability

## Configuration Surface

**To swap LLMs without code changes:**
```typescript
{
  speciesModelMap: {
    "species_0": "gpt-4",
    "species_1": "gpt-3.5-turbo"
  }
}
```

**To use baseline agents:**
```typescript
{
  config: {
    useBaselineAgents: true,
    baselinePolicyMap: {
      "species_0": "cooperative",
      "species_1": "defector"
    }
  }
}
```

## Verification Checklist

- [ ] Results differ meaningfully between GPT-3.5 and GPT-4
- [ ] Baseline agents produce predictable outcomes
- [ ] LLM failures do not crash simulation
- [ ] Constraints are enforced (not just suggested)
- [ ] Temperature effects are documented
- [ ] Context window is sufficient for task

