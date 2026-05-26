# Why Domain-Specific Cyber Warfare Payoffs Instead of Prisoner's Dilemma?

This document explains why this simulation uses custom payoff matrices from the cyber warfare academic paper rather than the classic Prisoner's Dilemma (PD), and what it would take to switch.

A standalone PD implementation is provided in `prisoners_dilemma.py` at the project root for direct comparison.

---

## 1. The Structural Similarity

Both approaches share the same skeleton: a **2x2 simultaneous-move game** where two players pick one of two actions without knowing the opponent's choice. The payoffs are read from a matrix.

```
              Player B: Action 1    Player B: Action 2
Player A: Action 1    (a1, b1)          (a2, b2)
Player A: Action 2    (a3, b3)          (a4, b4)
```

In our simulation, the two actions are **Attack (R)** and **Threaten (Th)**. In PD, they would be **Cooperate (C)** and **Defect (D)**. The game controller (`src/controller.py`) does not care what the actions are called or what values sit in the matrix -- it just looks up `matrix[row][col]` after both players choose.

So structurally, this simulation **already runs matrix games that could be Prisoner's Dilemmas**. The difference is entirely in the payoff values and the surrounding context.

---

## 2. Why We Use Domain-Specific Payoffs

### 2.1 The research question demands it

The goal of this simulation is not "can LLMs play Prisoner's Dilemma?" (that has been studied extensively). The goal is: **when LLM agents are placed in a cyber warfare scenario with realistic strategic trade-offs, do their decisions align with game-theoretic equilibria from the formal model?**

The payoff matrices encode the specific strategic tensions of cyber conflict:

| Parameter | What it captures | Why PD can't express it |
|-----------|-----------------|------------------------|
| Escalation risk (alpha) | Cyber attacks can spiral into kinetic conflict | PD has no escalation dimension |
| Attribution likelihood (beta) | States want plausible deniability | PD has no identity/anonymity dimension |
| Threat credibility (gamma) | Threatening is only useful if believable | PD's "cooperate" is not a threat -- it's passive non-defection |
| Operational success (v) | Different attack modes have different success rates | PD payoffs are abstract, not tied to operational parameters |
| Cost (c) | Private actors are cheap, coalitions share cost, states pay full price | PD doesn't distinguish between actor types |

The formulas `pi_R = (v-c)(1-beta)/(1-alpha)` and `pi_Th = (v-c)*gamma` produce payoffs that reflect these real-world trade-offs. A generic PD matrix like `(3,3), (0,5), (5,0), (1,1)` discards all of this domain knowledge.

### 2.2 The two-stage structure requires domain payoffs

The simulation is not a single 2x2 game. It is a **two-stage game**:

1. **Stage 1:** Nine 2x2 subgames (one per mode combination: P/S/C x P/S/C)
2. **Stage 2:** A 3x3 meta-game built from the nine subgame results

The nine subgames have **different** payoff matrices because the five parameters (v, c, alpha, beta, gamma) change with each mode combination. A Private Actor attacking a State Unit produces different risk/reward trade-offs than a Coalition attacking another Coalition.

If we used identical PD matrices for all nine subgames, every subgame would have the same equilibrium, the meta-game would be trivial (all modes yield the same payoff), and the simulation would collapse into a single PD repeated nine times with no strategic depth.

### 2.3 The solution concepts (Maxmin/Minmax) need asymmetric payoffs

The simulation compares two risk orientations:
- **Maxmin (defensive):** maximize your worst-case payoff
- **Minmax (aggressive):** minimize the opponent's best-case payoff

These produce **different payoff matrices** (stored in `src/constants/Sim 1 - Maxmin/` and `src/constants/Sim1 - Minmax/`). The Price of Aggression ratio `Lambda = pi_Defensive / pi_Aggressive` measures whether defense or aggression is preferable.

Classic PD has a single fixed matrix. It doesn't have a "defensive version" and an "aggressive version" because the payoffs don't come from underlying parameters that can be optimized under different risk attitudes.

### 2.4 The academic paper's central claim depends on these specific payoffs

The paper argues that **defensive cyber strategies often dominate aggressive ones** (Lambda > 1). This finding emerges from the specific parameter values for each attack mode. Using PD payoffs would test a completely different hypothesis ("do LLMs defect in PD?") that has no bearing on cyber warfare policy.

---

## 3. Would Implementing Prisoner's Dilemma Make the Code Simpler or More Complex?

**Simpler. Significantly simpler.**

Here is a concrete comparison:

### What the current code requires

| Component | Current (Cyber Warfare) | With PD |
|-----------|------------------------|---------|
| Input data | 36 CSV files (18 per solution concept) | 0 files -- hardcode a single 2x2 matrix |
| Data loading | `src/data_loader.py` -- 25 lines parsing CSVs | Delete entirely |
| Game stages | Two stages (9 subgames + 1 meta-game) | One stage (single 2x2 game) |
| Modes | 3 modes (P, S, C) with descriptions | None -- PD has no mode concept |
| Mode descriptions | `MODE_DESCRIPTIONS` dict in `src/constants.py` | Delete entirely |
| Action descriptions | Domain-specific formulas in `src/constants.py` | Replace with "Cooperate" / "Defect" |
| Meta-game logic | `build_meta_game_matrix()`, `play_meta_game()` in `src/controller.py` | Delete entirely |
| Agent prompting | Detailed cyber warfare context, risk orientation | Simple PD framing |
| Analysis | Subgame aggregation, meta-game analysis, Price of Aggression | Single game outcome |
| Solution concepts | Maxmin and Minmax with separate data directories | Not applicable |
| Total LLM calls per run | 20 (9 subgames x 2 + 1 meta-game x 2) | 2 (one per player) |

### The PD implementation

A standalone PD version is available at `prisoners_dilemma.py` in the project root. It uses the same Concordia integration (Entity, LanguageModel, ActionSpec) but with:

```python
PAYOFFS = {
    ("C", "C"): (3, 3),   # mutual cooperation
    ("C", "D"): (0, 5),   # sucker's payoff / temptation
    ("D", "C"): (5, 0),   # temptation / sucker's payoff
    ("D", "D"): (1, 1),   # mutual defection
}
```

No CSV loading, no mode combinations, no two-stage structure, no meta-game, no Price of Aggression. Run it with:

```bash
python3 prisoners_dilemma.py --backend gemini --runs 5
```

### Complexity comparison

| Metric | Cyber Warfare | Prisoner's Dilemma | Change |
|--------|--------------|-------------------|--------|
| Lines of code (total) | ~600 (across modules) | ~340 (single file) | -43% |
| External data files | 36 CSVs | 0 | -100% |
| Source modules | 8 files | 1 file | -88% |
| LLM calls per run | 20 | 2 | -90% |
| Game stages | 2 | 1 | -50% |
| Distinct subgames | 9 | 1 | -89% |

---

## 4. So Why Not Just Use PD?

Because **simplicity is not the goal -- domain validity is**.

The simulation exists to answer a domain-specific question: how do LLM agents handle the strategic nuances of cyber warfare (escalation risk, attribution, threat credibility, actor-type trade-offs)? Prisoner's Dilemma abstracts away every one of these dimensions into a single cooperate/defect binary.

PD would be the right choice if the research question were: "do LLMs cooperate or defect in a generic social dilemma?" That is a valid and well-studied question, but it is not this project's question.

The added complexity of domain-specific payoffs is not accidental -- it is the entire point. The 36 CSV files, the two-stage structure, the nine mode combinations, and the Price of Aggression analysis all exist because the cyber warfare model requires them to produce meaningful results.

---

## 5. Both Coexist

Both implementations are available in this project:

| File | Game | Run command |
|------|------|-------------|
| `main.py` | Cyber Warfare (domain-specific) | `python3 main.py --runs 5` |
| `prisoners_dilemma.py` | Prisoner's Dilemma (generic) | `python3 prisoners_dilemma.py --backend gemini --runs 5` |

Both use the same Concordia integration (Entity interface, LanguageModel ABC, ActionSpec). The difference is entirely in the game logic and data.
