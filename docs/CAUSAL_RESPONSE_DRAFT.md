# Offline causal-response draft

This branch contains a partial, offline implementation of the [prospective protocol](CAUSAL_RESPONSE_PROTOCOL.md). It is not a completed study runner. No model calls or experimental outcomes were generated. The independently reviewed optional simulation controls remain at commit `e94be11` on `codex/research-recovery`.

The draft adds a finite-grid, four-step harvest reference, 64 synthetic paired prompt cells, and a response/comprehension parser in `lib/research/causalResponse.ts`. Five targeted tests cover production-transition agreement, an independent deterministic two-step exhaustive fixture, paired-cell isolation, one grid-refinement/placebo example, and separation of comprehension failures from illegal actions. These checks establish limited implementation behavior, not research success or full reference convergence.

The reference assumes discounted own realized harvest, zero terminal value, fixed governance, and a partner whose type becomes public after the first decision. These are explicit diagnostic assumptions, not the original simulator's population objective or evidence of a model's preferences. Three-point normal quadrature per noise variable and linear stock interpolation are numerical approximations.

Before any future inference, this draft still needs independent instrument review, complete-panel numerical convergence and baseline gates, a frozen model/settings manifest, token-aware treatment checks, a failure-inclusive runner, raw provenance recording, and paired outcome/attrition analysis. Announcement text is character-padded, not verified to match token counts. Response parsing uses ordinary JSON parsing and does not reject duplicate JSON keys. The numerical helpers currently assume trusted experiment inputs. Do not expose them as an untrusted API or claim that all protocol gates have passed.

Checkpoint verification: `npm test -- tests/lib/llm/causalResponse.test.ts` passed all five tests; `npm run typecheck` passed. No full-suite rerun or inference is part of this draft checkpoint.
