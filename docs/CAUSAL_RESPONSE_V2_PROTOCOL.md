# Causal response protocol v2

Status: the comprehension-only pretest is frozen before any v2 response outcome. V1 remains an immutable failed panel and is neither pooled nor replaced. Token calibration, strategic-prompt calls, collection-manifest creation, and the 64-cell panel are not authorized by this freeze.

## Selection before strategy

The fixed ladder is DeepSeek-R1 8B Q4_K_M followed by Llama 3 8B Q4_0. Each attempted model receives eight comprehension-only cells covering stocks 20, 40, 60 and 80 twice. A cell passes only when valid structured output gives logistic growth, the no-harvest/no-noise next stock and the absence of a binding quota within 0.01 where numeric. The model must pass 8/8. Stop at the first passing model; attempt Llama only if DeepSeek fails. There are no retries, repairs, replacement cells or model downloads.

This separates rule comprehension from strategy. The pretest contains no announcement, partner history or harvest choice, so model selection cannot depend on a treatment response or desirable extraction level.

## Proposed native-token preflight (not yet authorized)

Only the selected model proceeds to token preflight. The four factorial arms initially use empty `neutralFormatPadding`. For a representative quartet, the preflight records native `prompt_eval_count`, takes the unpadded maximum as the target, and selects for each arm the smallest fixed candidate `" pad".repeat(n)`, `n=0..32`, that reaches that target. These are strategic-prompt calibration calls that generate one token. Their raw content is retained, every calibration call is excluded from the causal panel, and generated content may never be inspected or used for model, padding, gate or outcome selection. The chosen padding must then yield exactly equal prompt counts across all four arms in every quartet. Failure blocks the panel.

The preflight does not tune treatment wording. Its selection code may read only `prompt_eval_count` and must not inspect a generated strategic answer. Its raw calls and counts remain evidence. The selected digest, padding, 64 prompt hashes and passing preflight must be committed in a separate collection manifest before the panel.

## Proposed panel and estimands (not yet authorized)

The panel uses eight fresh world seeds (1103, 1109, 1117, 1123, 1129, 1151, 1153 and 1163), disjoint from v1, with both roles and the announcement-by-history-visibility factorial. It uses a v2 prompt and a harvest-only response schema. Rules, objective, action range, partner policies, sampling seed and provider settings are fixed within each quartet. The announcement remains advisory: it changes no payoff, cap, fine or legal action.

Arm-specific `neutralFormatPadding` is visible to the model and therefore confounded with announcement/history, even if native token counts are equal. The proposed estimands below are effects of the four entire frozen prompt packages. They cannot identify the announcement semantics separately from formatting. Any later claim must retain that limitation or first freeze an orthogonally balanced padding design.

For every complete role quartet:

- announcement-package effect = average of the entire announcement-package minus neutral-package contrast under visible and masked history;
- visibility effect = average of visible-minus-masked under announcement and neutral;
- interaction = visible announcement effect minus masked announcement effect.

Role effects are averaged within world. The announcement and interaction are two-sided co-primary tests using exact enumeration of all world-effect sign flips, conditional on the frozen panel, and Holm correction at family-wise 0.05. Their randomization interpretation relies on symmetry/exchangeability of world effects; with eight fixed worlds they are exploratory. Visibility is secondary and descriptive. Only complete valid quartets enter estimates. Interpretation requires at least 61/64 valid cells, at most one incomplete quartet and all eight worlds represented. Regardless of direction, a request is not labelled cooperation or defection.

Akata et al. found controlled changes in LLM coordination after changing opponent information and prompt structure, alongside strongly self-interested behavior in some repeated dilemmas ([Nature Human Behaviour, 2025](https://www.nature.com/articles/s41562-025-02172-y)). That primary study motivates isolating information and message interventions; it does not predict this simulator's result.

## Promotion limits

An independently implemented, fail-closed pre-outcome audit must verify treatment/control isolation, exact prompt hashes and token equality before collection. Root's review is an internal pre-outcome implementation review, not external or independent scientific review; that promotion gate remains unmet. Software validity does not establish ecological validity, stable model behavior or an enforceable institution. Any failed or interrupted artifact remains immutable and in its planned denominator.
