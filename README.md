# THE THIRD PILLAR

**Multi-agent simulation measuring LLM strategic behavior in resource competition under asymmetric information and institutional constraints.**

## Evaluation Surface

The system is used to evaluate how increasing model capability affects strategic outcomes in social dilemmas.

### Model Capability Ladder

Models are categorized into a tiered capability ladder to establish a baseline and measure scaling effects:

1.  **Baseline / Low-capability**
    *   LLaMA-3 8B / 13B (chat)
    *   Mistral 7B
    *   Qwen 7B
    *   *Purpose*: Establish naïve cooperation and limited strategic exploitation.

2.  **Mid-capability**
    *   LLaMA-3 70B
    *   Mixtral 8x7B
    *   Qwen 32B
    *   *Purpose*: Test emergence of strategic defection, treaty gaming, and partial stabilization.

3.  **High-capability / Reasoning-heavy**
    *   GPT-4 / GPT-4.1
    *   DeepSeek-R1
    *   o1 / o1-mini
    *   Claude 3.5 Sonnet / Opus
    *   *Purpose*: Test whether increased reasoning stabilizes institutions, accelerates extractive equilibria, or exploits language/institutional loopholes.

### Methodology

*   **Fixed Policies**: Models are used as fixed policy generators. No training or self-modifying prompts are allowed.
*   **Zero Learning**: Agents have no memory beyond the provided state and cannot learn across runs.
*   **Identical Prototyping**: Each model is queried once per tick per agent with identical prompts (filtered by asymmetric observation).
*   **Comparative Analysis**: Models are evaluated by running identical environments with fixed initial seeds and agent roles.

## Core Metrics

Models are compared across the following longitudinal axes:
- **Time-to-collapse** (TTC)
- **Inequality** (Gini over extraction)
- **Treaty Stability** (Violation rate vs formation rate)
- **Resource Trajectories** (Sustainability delta)

## Research Question

**Does increasing LLM capability expand the space of stable cooperative equilibria, or does it expand the space of exploitative, collapse-inducing strategies?**

## Key Features

- **Derived dilemmas**: Social dilemmas emerge from resource dynamics, not scripted payoffs.
- **Language constraints**: Linguistic regimes mechanically restrict treaty formation and expression.
- **Epistemic asymmetry**: Agents operate on different time scales and observation bandwidths (Orders 0, 1, and 2).
- **Institutional formation**: Machine-readable treaties with automatic enforcement.
- **Voxel Lattice**: A 3D Orthogon world for access permissions and causal separation.

## Documentation

- [Evaluation Surface & Methodology](docs/EVALUATION_SURFACE.md)
- [Scientific Object Definition](docs/SCIENTIFIC_OBJECT.md)
- [Positioning vs Existing Work](docs/POSITIONING.md)
- [LLM Usage Audit](docs/LLM_USAGE_AUDIT.md)
- [Quality Bar](docs/QUALITY_BAR.md)
- [UI to State Mapping](docs/UI_STATE_MAPPING.md)

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## System Requirements

- Node.js 18+
- API keys for relevant LLM providers (OpenAI, DeepSeek, etc.)
- Baseline agents work without API keys.

## License

ISC
