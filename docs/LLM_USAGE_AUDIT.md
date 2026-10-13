# LLM operational protocol

The supported default is an explicit fixed-policy baseline. A baseline is labelled `baseline:<policy>` in the world state and `mode: baseline` in provenance; it never calls a provider. No model capability ladder is assumed from parameter counts or marketing names.

Live mode requires explicit enablement, an exact model allowlist, credentials, and authenticated API requests. A species receives its own traits, filtered observation, visible resource definitions, and visible species identifiers. `promptBuilder.ts` is the versioned experimental prompt. An action is a bounded JSON decision; invalid live responses abort the run. There is no fallback mock, alternate provider, retry, or claim that an unexecuted model succeeded.

A call is capped at 30 seconds and 1,000 generated tokens by default (at most 2,000 when using the internal adapter explicitly). Runs are bounded before any call; batch mode is baseline-only. The adapter targets the OpenAI chat-completion interface. Compatibility with a particular model's sampling options must be tested explicitly before a study; a configured name is not evidence of compatibility or a completed evaluation.

There is no training or persistent cross-run learning. The observation may include recent events and active treaties within a run; describing the policy as having no memory would be inaccurate. A fixed environmental seed does not make remote model inference deterministic.

A publishable live experiment additionally needs an archived prompt/action transcript, resolved provider model version, sampling settings, token usage and cost, failed-attempt accounting, repeated samples per seed, and paired confidence intervals. Those data are not included in this release, and no live-provider result is claimed.
