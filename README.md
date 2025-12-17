# THE THIRD PILLAR

**An evolution-first social dilemma benchmark for measuring cooperation, defection, and collapse as a function of LLM capability.**

## Core Definition

A stochastic dynamical system with:
- **State S_t**: Resource stocks, species populations, active treaties, information access states
- **Agents π_i**: Species-level policies controlled by LLMs
- **Environment E**: Dynamics that derive social dilemmas from resource coupling
- **Information I**: Constraints on observation and action (epistemic orders, linguistic regimes)
- **Metrics M**: Falsifiable outcome measures (collapse probability, cooperation index, welfare)

## Research Question

**Does increasing LLM capability expand the space of stable cooperative equilibria, or does it expand the space of exploitative, collapse-inducing strategies?**

## Key Features

- **Derived dilemmas**: Social dilemmas emerge from resource dynamics, not scripted payoffs
- **Language constraints**: Linguistic regimes mechanically restrict treaty formation
- **Epistemic asymmetry**: Agents operate on different time scales and observation bandwidths
- **Institutional formation**: Treaties impose machine-readable constraints
- **Baseline comparison**: Fixed-policy agents for ablation studies

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Documentation

- [Scientific Object Definition](docs/SCIENTIFIC_OBJECT.md)
- [Positioning vs Existing Work](docs/POSITIONING.md)
- [LLM Usage Audit](docs/LLM_USAGE_AUDIT.md)
- [Quality Bar](docs/QUALITY_BAR.md)
- [UI to State Mapping](docs/UI_STATE_MAPPING.md)
- [Hardening Summary](docs/HARDENING_SUMMARY.md)

## Minimal Experiment

**Hypothesis**: Increasing LLM capability expands cooperative equilibria.

**Test**:
1. Run with GPT-3.5 agents
2. Run with GPT-4 agents
3. Compare: collapse time, cooperation index, welfare

**Falsification**: If GPT-4 produces earlier collapse or lower cooperation → hypothesis falsified.

## System Requirements

- Node.js 18+
- OpenAI API key (for LLM agents)
- Baseline agents work without API key

## License

ISC
