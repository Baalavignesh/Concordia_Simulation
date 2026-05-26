# Cyber Wargame Simulation — Concise Report

**Backend:** Gemini 2.5 Flash · **Configs:** 5 persona variants · **Concepts:** Maxmin (defensive) + Minmax (aggressive)

---

## 1. Maxmin (Defensive) — Without CoT

Agents instructed to be **risk-averse**: maximize worst-case payoff.

| Config             | A Attack Rate | B Attack Rate | Meta-Game (A → B) | World State            | Payoff A | Payoff B |
| ------------------ | :-----------: | :-----------: | ----------------- | ---------------------- | :------: | :------: |
| v1 Rational        |      67%      |      89%      | P → P             | Mutual Deterrence      |   0.90   |   0.00   |
| v2 Satisficing     |    **0%**     |    **0%**     | P → P             | Mutual Deterrence      |   0.90   |   0.00   |
| v3 Prospect Theory |      33%      |      67%      | P → P             | Mutual Deterrence      |   0.90   |   0.00   |
| v4 Hawkish         |   **100%**    |   **100%**    | P → S             | **Mutual Conflict**    |   0.71   |  -2.67   |
| v5 Retaliatory     |      89%      |      89%      | P → S             | Asymmetric (A attacks) |   0.71   |  -2.67   |

**Takeaway:** v1/v2/v3 converge to Mutual Deterrence despite different subgame behavior. v4/v5 spiral into conflict.

---

## 2. Minmax (Aggressive) — Without CoT

Agents instructed to be **risk-seeking**: minimize opponent's best-case payoff.

| Config             | A Attack Rate | B Attack Rate | Meta-Game (A → B) | World State              |  Payoff A  | Payoff B |
| ------------------ | :-----------: | :-----------: | ----------------- | ------------------------ | :--------: | :------: |
| v1 Rational        |      44%      |     100%      | P → P             | Asymmetric (A threatens) |   -3.60    |  -4.55   |
| v2 Satisficing     |    **0%**     |    **0%**     | S → S             | Mutual Deterrence        |   -3.30    |  -3.75   |
| v3 Prospect Theory |      11%      |     100%      | P → P             | Asymmetric (A threatens) |   -3.60    |  -4.55   |
| v4 Hawkish         |   **100%**    |   **100%**    | **C** → S         | **Mutual Conflict**      | **-63.00** |  -6.67   |
| v5 Retaliatory     |   **100%**    |   **100%**    | **C** → P         | **Mutual Conflict**      | **-63.00** |  -8.91   |

**Takeaway:** v4/v5 chose Coalition mode → catastrophic escalation (-63.00). v2 Satisficing accidentally outperformed rational play (-3.30 vs -3.60).

---

## 3. Maxmin (Defensive) — With CoT

| Config             | A Attack Rate | B Attack Rate | Meta-Game (A → B) | World State         | Payoff A |
| ------------------ | :-----------: | :-----------: | ----------------- | ------------------- | :------: |
| v1 Rational        |   **100%**    |      98%      | P → P             | **Mutual Conflict** |   0.71   |
| v2 Satisficing     |    **96%**    |      82%      | P(3)/S(2) → P     | Conflict (4/5)      |   0.46   |
| v3 Prospect Theory |   **100%**    |      89%      | **S** → P         | **Mutual Conflict** |   0.00   |
| v4 Hawkish         |      89%      |    **56%**    | P → P             | **Mutual Conflict** |   0.71   |
| v5 Retaliatory     |      89%      |     100%      | P → P             | **Mutual Conflict** |   0.71   |

**Takeaway:** CoT pushed all agents toward attacking (v2 went from 0% → 96%). Deterrence outcomes disappeared. Notably, v4 Hawkish B _decreased_ to 56% — CoT reasoning overrode aggression bias.

---

## 4. Minmax (Aggressive) — With CoT

| Config             | A Attack Rate | B Attack Rate | Meta-Game (A → B) | World State         |  Payoff A  |
| ------------------ | :-----------: | :-----------: | ----------------- | ------------------- | :--------: |
| v1 Rational        |   **100%**    |      98%      | P → P(4)/S(1)     | **Mutual Conflict** |   -18.29   |
| v2 Satisficing     |    **98%**    |      98%      | P(2)/S(3) → P     | **Mutual Conflict** |   -15.95   |
| v3 Prospect Theory |   **100%**    |     100%      | P → P             | **Mutual Conflict** |   -18.29   |
| v4 Hawkish         |     100%      |      78%      | P → P             | **Mutual Conflict** |   -18.29   |
| v5 Retaliatory     |      89%      |      89%      | **S** → P         | **Mutual Conflict** | **-14.40** |

**Takeaway:** CoT _improved_ irrational agents — v4/v5 avoided Coalition mode (from -63.00 to ~-14 to -18). But rational agents got _worse_ (from -3.60 to -18.29).

---

## 5. Price of Aggression (Λ = Defensive Payoff / Aggressive Payoff)

| Config             | Λ_A (No CoT) | Interpretation                      |
| ------------------ | :----------: | ----------------------------------- |
| v1 Rational        |    -0.25     | Aggression costly                   |
| v2 Satisficing     |    -0.27     | Aggression costly                   |
| v3 Prospect Theory |    -0.25     | Same as rational                    |
| v4 Hawkish         |  **-0.011**  | Catastrophically costly (89× worse) |
| v5 Retaliatory     |  **-0.011**  | Same catastrophic pattern           |

---

## 6. CoT vs No-CoT — Key Differences

| Dimension                   | Without CoT                       | With CoT                 |
| --------------------------- | --------------------------------- | ------------------------ |
| Persona differentiation     | **Strong** (0%–100% attack range) | Reduced (56%–100%)       |
| Average aggression          | Moderate (varies by persona)      | **High** (mostly attack) |
| Best Maxmin payoff (A)      | **0.90** (Deterrence)             | 0.71 (Conflict)          |
| Best Minmax payoff (A)      | **-3.30** (Satisficing)           | -14.40 (Retaliatory)     |
| Irrational agent worst case | **-63.00** (catastrophic)         | -18.29 (improved)        |
| Reasoning explainability    | None                              | **Full traces stored**   |

**Key insight:** CoT creates "analytical gravity" — visible payoff numbers dominate persona framing during step-by-step reasoning. Personas still influence _meta-game_ mode choice but not _subgame_ tactics.

---

## 7. Bottom Line

- **No-CoT** is better for studying persona-driven behavioral differences (maximum differentiation).
- **CoT** is better for preventing irrational agents' worst mistakes and for reasoning interpretability.
- Satisficing = maximum peace (0% attack without CoT). Hawkish = maximum war (100% attack).
- Rational, Satisficing, and Prospect Theory converge at the meta-game level despite different subgame tactics.
- Irrational agents (Hawkish, Retaliatory) consistently produce mutual conflict and worse payoffs.
