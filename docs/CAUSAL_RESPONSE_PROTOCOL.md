# Prospective causal response protocol v1

Status: design only. No calls or results from this study are reported. Its decision reference, treatment renderer, comprehension instrument and complete runner still need implementation and independent review. The [optional controls](EXPERIMENT_CONTROLS.md) are necessary preparation, not completion of these gates.

## Question and scope

With numerical rules common across arms and legal actions/payoffs fixed, does a nonbinding harvest-quota announcement change a model's requests, and does visibility of a partner's previous requests moderate that response? A null or increased-extraction result is admissible. The goal is measurement of responses, not tuning prompts or incentives until cooperation appears.

The original episode pilot does not answer this: its requests exceed the available stock, but its prompt omits numerical regeneration/collapse rules. Existing treaty records lack independent assent and resource fines. An announcement is therefore explicitly **nonbinding coordination**, not a negotiated or enforced institution. Visibility masks partner request history only; resource IDs, legal requests, resource visibility, acting schedule and allocations stay fixed. Do not use `useEpistemicOrders` as a pure visibility intervention.

## Frozen panel and estimands

Eight fresh seeds: 1009, 1013, 1019, 1021, 1031, 1033, 1039, 1049. Both focal roles, four arms per snapshot: announcement versus length-matched neutral message crossed with visible versus masked partner request history. At most 64 model calls, one sample per cell, balanced condition order. Source-generated snapshots use prespecified stock bins 40 and 80 and transparent partner policies. Fix the exact model digest, snapshot manifest, messages, model sampling seeds and budgets in the implementation manifest before any call; this document does not authorize choosing them after outcomes.

The primary estimands are paired differences in focal absolute requests for announcement, visibility and their interaction. Report every quartet and world-cluster uncertainty with eight worlds as units; roles and arms are dependent. Secondary outcomes are request minus quota, action validity, numerical-rule comprehension, and one-step physical outcomes against the same transparent partner. This is a small initial response study, not evidence of multi-step adaptation or model rankings. No unvalidated cooperation/deception proxy is primary.

## Required controls before inference

1. Use the complete numerical transition and declared evaluation objective equally across arms. Resource-rule grounding alone does not specify population utility. Freeze a separate comprehension instrument; failed comprehension must not be relabelled as strategic defection.
2. Pair exogenous observation and physical draws by explicit seed/step/entity keys. Tests must show administrative speech/treaty events cannot shift them. Check that the history mask changes neither other observations nor the legal action space, and cannot leak through summaries or text references.
3. Retain MSY-share, conservative and greedy heuristics as transparent controls, without calling them globally rational. Add a finite-horizon reference optimizing its explicitly declared discounted own realized harvest over four steps, with stated partner policy/prior, noise expectation and terminal value zero. Its objective is a reference assumption, not evidence of a model's preferences.
4. Validate the decision reference against exhaustive coarse-grid search and prespecified grid refinement. Its action must be identical under a nonbinding announcement with unchanged payoff and information. If the placebo changes its action, inference is blocked. Visibility may update its posterior over a prespecified partner-type prior.
5. Archive source/data/model hashes, full requests, native prompt counts where supported, responses, all outcome failures and resource draws. Exact prompt-token completeness remains a separately checked property. No retries, repairs, replacement seeds or post-outcome task filtering.

## Failure accounting and promotion

All 64 planned cells remain in the denominator. Categorize transport, truncation, syntax, semantic and comprehension failures separately. An invalid action is neither cooperation nor defection. If any quartet is incomplete, report complete-case differences alongside attrition and worst-case full-panel bounds using the legal request range [0,100]. Below 95% valid calls or more than one incomplete quartet makes general model-response interpretation inconclusive; preserve the diagnostic data.

Promotion requires independent instrument review, repeated samples on new worlds and role-balanced partner mixtures. Claims about stronger institutions additionally require formal consent and enforcement contracts. Passing software tests or finding a desirable direction of effect cannot substitute for those gates.
