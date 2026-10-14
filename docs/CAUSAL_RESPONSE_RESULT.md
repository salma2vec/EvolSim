# Frozen causal-response panel result

The instrument audit passed every frozen offline gate at source commit `46aade7dc490353b5265bbcb92208e69ef45c5b2`. Its 64 cells and 16 quartets were unique and isolated, all three adversarial mutations were detected, keyed exogenous draws were arm-invariant, the nonbinding reference placebo was exactly zero, and coarse versus refined reference actions and values had zero observed difference. The saved artifact replayed exactly before model collection.

One panel was then frozen at commit `b074f583cfb12aecd498b4ab8bbacde0ea09a37e` and executed against the already installed local `qwen2.5-coder:1.5b` Q4_K_M model, digest `d7372fd828518a4d38b1eb196c673c31a85f2ed302b3d1e406c4c2d1b64a0668`, through Ollama 0.40.1. No model was downloaded. The run made exactly 64 calls in the frozen order, with temperature 0, fixed per-cell seeds, a 256-token output cap, a 30-second timeout, no retries and no replacement cells. Raw requests, raw responses, hashes, native counts, timings and failures are retained in `results/causal-response-qwen25coder15b.json`.

## Gate result

All 64 calls returned HTTP 200, provider stop, valid JSON and a schema-valid action. All 64 failed the separately frozen numerical comprehension instrument, so the analysis-eligible rate is **0/64**, and complete quartets are **0/16**. The model consistently returned the regeneration-rate parameter `0.15` as growth and returned unchanged stock (`40` or `80`) as the no-harvest next stock, rather than applying logistic growth. It correctly marked the quota nonbinding in all 64 responses. These are instrument diagnostics, not strategic outcomes.

The native prompt counts also differed by eight tokens between every announcement/neutral pair even though the announcement fields had equal UTF-8 byte length. The frozen analysis gate therefore fails independently on comprehension and complete quartets; token balance is also false. The causal effect is **inconclusive and unestimated**: no announcement, visibility or interaction estimate is reported, and no harvest request is labelled cooperation or defection.

The result does not prove the research goal. It rejects this particular model-and-instrument combination as a valid strategic panel. Root reviewed the protocol before outcomes, but no external or independent scientific review occurred, so the promotion gate remains unmet even if a future collection passes its validity gates.

Offline verification makes zero inference calls:

```bash
npm run causal:replay-panel -- results/causal-response-qwen25coder15b.json
```

The next gate is a genuinely independent review of the instrument and a new, prospectively frozen protocol version that fixes native token balance and tests numerical comprehension independently before any strategic treatment panel. This failed panel must remain immutable and cannot be repaired, retried, pooled with, or replaced by that future work.
