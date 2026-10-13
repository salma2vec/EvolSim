# Related work

[Willis et al., *Evaluating Collective Behaviour of Hundreds of LLM Agents* (2026, v2)](https://arxiv.org/abs/2602.16662) evaluate public-goods, collective-risk and common-pool games using LLM-generated strategies translated into code, with population-level analyses. This project instead exposes a small stepwise dynamical simulator with explicit language and information constraints. It does not reproduce that paper's population-scale analysis or results.

[Curvo et al., *Reproducibility Study of Cooperate or Collapse* (2025)](https://arxiv.org/abs/2505.09289) replicate and extend GovSim resource-sharing experiments, including heterogeneous agents and language variations. That work motivates explicit controls and careful accounting for model/scenario differences. No GovSim baseline is implemented here, and no claim is made that GovSim assumes universally full information or costless communication.

[Leibo et al., *Scalable Evaluation of Multi-Agent Reinforcement Learning with Melting Pot* (ICML 2021)](https://proceedings.mlr.press/v139/leibo21a.html) emphasize generalization to unfamiliar social partners. The present paired-seed baseline experiment checks internal behavior only; held-out partners and validated generalization remain future work.

Anathem-inspired epistemic orders and Embassytown-inspired linguistic regimes are design metaphors, not scientific validation. Combining mechanisms does not establish novelty or superiority. The immediate contribution is an inspectable implementation, reproducible baseline controls, and explicit failure boundaries.
