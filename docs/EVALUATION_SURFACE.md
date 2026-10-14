# Evaluation protocol

Protocol 2.1.0 includes the strict live-action validation boundary introduced after the local compatibility check. `npm run benchmark` runs four fixed policies on identical preset/seed pairs, saves complete histories and applied configuration, and records source and trajectory digests. The deterministic regression test also interleaves two runs to check that their random streams do not interfere. The 20 baseline trajectories match protocol 2.0.0; live responses now fail on unknown or hidden IDs and invalid action fields before state transitions. The shared sanitizer preserves valid zero governance and communication.

## Controls and metrics

The baseline harvest reference is an equal perceived-species share of logistic maximum sustainable yield `r*K/4`. Cooperative agents request that share, conservative agents request half, defectors request 2.5 times it, and opportunistic agents adjust their request according to observed stock. These labels name policies; they do not guarantee sustainable outcomes under environmental shocks.

The primary report uses directly observed quantities: first resource-collapse time (null if censored), final total stock, and surviving species. Each run retains all states so these quantities can be recomputed. Report every seed; use paired differences when comparing policies. Do not treat time steps from the same trajectory as independent samples.

The UI's cooperation index is a descriptive proxy: realized `HARVEST` events are compared to an equal-share logistic MSY threshold, with an added treaty-violation penalty. It is not a validated psychological measure. The legacy welfare function computes a resource-stock value proxy, not population utility or individual reward. Treaty/deception displays remain exploratory: enforcement currently uses requested harvest and grammar-derived constraints, and violating treaties are removed. Do not use these measures to claim consent, deception detection, or institutional effectiveness without a separate validation study.

## Ablations and failures

Hold seeds and policy assignments fixed when changing `useEpistemicOrders`, `useLinguisticRegimes`, or `useTreaties`. Baseline policies emit no language/treaty actions: a null effect of those switches is expected and does not validate them. A resource collapse is an outcome; an invalid state, parser failure or provider error is a failed experiment and must be counted separately.

The five-seed example is an integrity/control experiment. It is not a powered comparison, does not cover out-of-distribution partners, and does not reproduce GovSim, Melting Pot or a published LLM result. Population/stress coefficients are uncalibrated and include a productivity multiplier; resource collapse is not mathematically guaranteed to imply population extinction.

## Future model-comparison protocol

Prespecify exact model IDs, fixed prompt and sampling settings, a decision-token budget, a seed panel, repeated inference samples and failure handling. Archive all prompts/actions and usage. Randomize or balance species roles and compare against transparent controls. Capability must be measured independently; model size or an assigned tier is not an independent capability measurement.
