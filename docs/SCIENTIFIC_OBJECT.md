# Scientific object

This project is a toy dynamical system with species-level policies, not individual organisms. A state comprises resource stocks/definitions, species traits and populations, active treaties, events, and living-simile references. Actions request absolute harvest units (0–100 per resource), diplomatic stances, governance settings, and optional communication/treaty text.

The resource update uses logistic growth, realized extraction, harvest noise, and an environmental shock. Stocks are bounded to `[0, 1.1*K]`; the upper clipping is an explicit numerical modelling choice. Falling below a resource's threshold makes collapse irreversible and stops regeneration. Scarcity allocates available stock proportionally. `HARVEST` events record the realized allocation before harvest noise; noise changes stock depletion and should not be interpreted as additional allocated yield.

Species population updates combine per-capita allocated resource, stress, reproduction coefficients and a planet-productivity multiplier, then apply a numerical population cap and extinction threshold. These quantities use synthetic units and are not empirically calibrated. Stored population trajectories therefore do not establish welfare, evolutionary fitness or ecological realism.

Epistemic orders combine visibility, action schedules, and access permissions. When order constraints are disabled, species act every step with global visibility and no stratified resource-access restriction. Linguistic regimes are grammar-based restrictions inspired by fiction; they do not provide general natural-language truth verification. Treaty proposals are checked by the configured grammar and can create agreements without a separate negotiated acceptance protocol. That is a design limitation, not evidence of institutional consent.

The research question is whether policy differences and explicit information/language constraints change commons outcomes in this system. The current evidence is executable baseline behavior and invariants. A live-LLM hypothesis remains untested here. Relevant definitions and reproduction requirements are in [the evaluation protocol](EVALUATION_SURFACE.md).
