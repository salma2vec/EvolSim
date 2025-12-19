# THE THIRD PILLAR: Scientific Object Definition

## Core Research Question

**Does increasing LLM capability expand the space of stable cooperative equilibria, or does it expand the space of exploitative, collapse-inducing strategies?**

## Formal System Definition

### State S_t

The state at time t is a tuple:

```
S_t = (R_t, P_t, T_t, I_t)
```

Where:

- **R_t**: Resource stocks
  - For each resource r: `(amount_r, collapsed_r, capacity_K_r, regen_rate_r, collapse_threshold_r)`
  - Resources follow logistic growth: `R_{t+1} = max(0, R_t + g*R_t*(1-R_t/K) - harvest_t + noise)`
  - Collapse occurs when `amount_r < collapse_threshold_r`

- **P_t**: Species populations
  - For each species i: `(population_i, alive_i, tech_level_i, governance_i)`
  - Population dynamics: `N_{i,t+1} = N_{i,t} * exp(a*resource_i - b*stress_i)`
  - Extinction when `population_i < threshold`

- **T_t**: Active treaties
  - For each treaty: `(id, signatories, constraints, violated, expires_at)`
  - Constraints are machine-readable: `{maxHarvestByResource: {r: limit}, minCooperationIndex: value}`

- **I_t**: Information access states
  - For each species i: `(observation_bandwidth_i, memory_summary_i, contact_window_i)`
  - Determines what each species observes and when it can act

### Agents π_i

Each agent is a **species-level policy** controlled by exactly one LLM per run.

- **Input**: Observation O_i,t (filtered by I_t)
- **Output**: Action A_i,t = `(harvest, relations, governance, treatyProposal)`
- **Policy**: `π_i(O_i,t) → A_i,t`

Agents are **not individuals**. They are collective species-level decision-makers.

### Environment Dynamics E

The environment E maps `(S_t, A_t) → S_{t+1}`:

1. **Resource Update**: `R_{t+1} = updateResources(R_t, harvest_t, planet)`
2. **Population Update**: `P_{t+1} = updatePopulations(P_t, R_{t+1}, stress_t)`
3. **Treaty Processing**: `T_{t+1} = processTreaties(T_t, proposals_t, violations_t)`
4. **Event Detection**: `Events_t = detectEvents(S_t, S_{t+1})`

**Key Property**: Social dilemmas are **DERIVED**, not scripted. Payoff surfaces emerge from:
- Resource coupling (shared resources)
- Time (discount factors, regeneration delays)
- Institutions (treaties, governance)

### Information Constraints I

Information constraints determine:

1. **Observation Bandwidth**: How much of global vs local state is visible
   - FastSecular: Full local, noisy global
   - Cloistered: Summarized global, detailed local history

2. **Memory**: How much history is retained
   - FastSecular: Short memory (last K steps)
   - Cloistered: Long memory (summarized over N steps)

3. **Contact Windows**: When treaties can be proposed/accepted
   - FastSecular: Always open
   - Cloistered: Only during conclave windows (every N steps)

4. **Linguistic Constraints**: What can be expressed in treaties
   - LiteralOnly: Only factual constraints based on current state
   - AnchoredReference: Only commitments referencing past events
   - Expressive: Free expression, but with ambiguity penalties

### Outcome Metrics M

All metrics must be:
- Computable from logs alone
- Comparable across model classes
- Stable under re-seeding

**Required Metrics**:

1. **Collapse Probability by T**: `P(collapse by time T)`
2. **Time-to-First-Collapse Distribution**: `P(T_collapse = t)`
3. **Mean Total Welfare**: `E[Σ_t Σ_i welfare_i,t]`
4. **Welfare Variance**: `Var[Σ_t Σ_i welfare_i,t]`
5. **Cooperation Index**: Distance from sustainable extraction
   - `CI_i = 1 - (actual_harvest - sustainable_harvest) / sustainable_harvest`
6. **Treaty Violation Rate**: `violations / total_treaties`
7. **Deception Gap**: `|stated_intent - realized_action|`
   - Tracked per treaty proposal and subsequent action

## Ablation Requirements

The system must support runs with:

- **No language constraints**: All agents can express freely
- **No epistemic orders**: All agents act every step with full information
- **No treaties**: Agents cannot form agreements
- **Baseline agents**: Fixed-policy heuristics (e.g., always harvest 10%, always cooperate)

If results do not change meaningfully across ablations, the system is not measuring what it claims to measure.

## Reproducibility

Every run must produce:

1. **Experiment Config**: Complete parameter specification
2. **Run Logs**: Full state history S_0, S_1, ..., S_T
3. **Metrics**: All M computed from logs
4. **Agent Policies**: Which LLM/model controlled each species

These must enable:
- Exact reproduction of runs
- Comparison across model classes
- Generation of paper figures



