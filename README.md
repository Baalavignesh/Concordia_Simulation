# Cyber Warfare Wargame Simulation

A two-stage strategic cyber conflict simulation built on [Google DeepMind's Concordia](https://github.com/google-deepmind/concordia) framework. Two LLM-backed agents (Country A and Country B) play a game-theoretic wargame derived from the academic paper *"Robust Cyber Warfare: Private Actors, States, or Coalitions?"*.

**Research question:** When LLM agents reason about strategic trade-offs, do their decisions align with the analytical equilibria predicted by formal game theory?

> **See [SETUP.md](SETUP.md) for step-by-step instructions on running simulations and viewing the results dashboard.**

---

## The Game

Two countries are engaged in a cyber conflict. Each must choose:

1. **An attack mode** — *how* to conduct operations (Private Actor, State Unit, or Coalition)
2. **An action type** — *what* to do (Attack or Threaten)

### Attack Modes

| Mode | Description |
|------|-------------|
| **Private Actor (P)** | Lowest cost, highest success rate, lowest escalation/attribution risk, lowest threat credibility |
| **State Unit (S)** | Highest cost, lower success, highest escalation/attribution risk, highest threat credibility |
| **Coalition (C)** | Shared cost, moderate success, highest escalation risk, moderate attribution and credibility |

### Action Types

| Action | Formula | Description |
|--------|---------|-------------|
| **Attack (R)** | `π = (v−c)(1−β)/(1−α)` | Execute the cyber operation. Higher impact, carries escalation and attribution risks |
| **Threaten (Th)** | `π = (v−c)·γ` | Threaten without executing. Lower risk, depends on threat credibility |

Where `v` = operational success, `c` = cost, `α` = escalation risk, `β` = attribution likelihood, `γ` = threat credibility.

### Two-Stage Structure

**Stage 1 — Nine 2×2 Subgames:**
For every combination of Country A's mode and Country B's mode (3×3 = 9), both players simultaneously choose Attack (R) or Threaten (Th). Payoffs are looked up from pre-computed CSV matrices.

```
         B=P       B=S       B=C
A=P    [PP game]  [PS game]  [PC game]
A=S    [SP game]  [SS game]  [SC game]
A=C    [CP game]  [CS game]  [CC game]
```

**Stage 2 — The 3×3 Meta-Game:**
The 9 realized payoffs populate a 3×3 matrix. Each player then chooses their overall attack mode (P, S, or C). The final payoff comes from the meta-game cell corresponding to both players' choices.

### Solution Concepts

- **Maxmin (Defensive):** Each player maximises their worst-case payoff — *"What's the best I can guarantee regardless of what my opponent does?"*
- **Minmax (Aggressive):** Each player minimises the opponent's best-case payoff — *"How can I make things worst for my opponent?"*

### World States

| Outcome | Classification |
|---------|---------------|
| Both Threaten | **Mutual Deterrence** — threats remain more valuable than attacks |
| Both Attack | **Mutual Conflict** — diminished returns for further attacks |
| One Attacks, One Threatens | **Asymmetric** — threats gain credibility, attacks lose value |

---

## Prompt Configurations (Agent Personas)

The simulation tests **five decision-making personas** to see how cognitive framing affects strategic behaviour:

| Config | Persona | Description |
|--------|---------|-------------|
| `v1_rational_eut` | Rational (EUT) | Perfect expected utility maximiser. Computes Nash equilibria, uses backward induction, no biases |
| `v2_bounded_satisficing` | Bounded Rational (Simon) | Satisficer. Sets "good enough" thresholds, uses heuristics, limited memory |
| `v3_bounded_prospect_theory` | Bounded Rational (Prospect Theory) | Loss-averse. Losses loom 2× larger, overweights small probabilities, reference-dependent |
| `v4_irrational_hawkish` | Irrational (Hawkish) | Overconfident aggressor. Overestimates own success, underestimates opponent, prefers Attack |
| `v5_irrational_retaliatory` | Irrational (Retaliatory) | Emotion-driven. Retaliates against aggression, mirrors/punishes opponent, neglects own payoffs |

Each config defines all prompt templates (game context, subgame observations, calls-to-action, agent identity) to steer the LLM into that persona. See `src/prompts/`.

---

## Results Included

Pre-computed results are included in `results/` and pre-loaded into the dashboard (`dashboard/public/data/`). All runs used **deepseek-r1:14b** via Ollama on Apple Silicon (M-series Mac).

**Symmetric runs** (same persona for both agents, 5 configs × 2 concepts × 1 run):
- Standard and Chain-of-Thought (CoT) variants for each config

**Cross-play runs** (different persona per agent, 20 asymmetric matchups × 2 concepts × 1 run):
- All ordered pairs of the 5 personas, both solution concepts

| Batch | Command | Runtime |
|-------|---------|---------|
| 5 symmetric configs, both concepts | `python3 main.py` | ~2 hours |
| Same, with Chain-of-Thought | `python3 main.py --cot` | ~5 hours |
| 20 cross-play matchups, both concepts | `python3 main.py --cross-play-asymmetric` | ~8–9 hours |
| Same, with Chain-of-Thought | `python3 main.py --cross-play-asymmetric --cot` | ~20–25 hours |

---

## Architecture

```
+------------------+
|  Game Controller |  (deterministic Python logic)
|  - Loads CSVs    |
|  - Runs 9+1 loop |
|  - Looks up pay  |
+--------+---------+
         |
 observe() / act()
        / \
+-------+   +-------+
| Agent |   | Agent |
|   A   |   |   B   |
| cfg_a |   | cfg_b |   <-- can be different personas (cross-play)
+-------+   +-------+
(LLM-backed Concordia Entities)
```

**Key design decisions:**
- Game rules are enforced by a deterministic Python controller, not an LLM Game Master. Turn order, payoff lookup, and termination are fixed — LLM calls are reserved only for the agents' strategic decisions.
- **Cross-play support:** The controller accepts separate prompt configs per agent, allowing a "rational maximiser" to play against a "hawkish aggressor" with each agent seeing the game through its own cognitive lens.

The project uses three abstractions from Concordia: `LanguageModel` (backend swapping), `Entity` (agent interface), and `ActionSpec` (constrained choice requests).

### Dependency Flow

```
constants ← data_loader ← controller ← main.py
                           ↑
backends/ (concordia only) agent (concordia + constants)
                           ↑
                      prompt_config
```

---

## Project Structure

```
Concordia_Simulation/
├── main.py                       # CLI entrypoint
├── analyze_cot.py                # Standalone CoT complexity analysis
├── copy_results.sh               # Copies results → dashboard/public/data/
├── watch_progress.py             # Terminal progress monitor for long runs
├── SETUP.md                      # Step-by-step running and dashboard guide
├── src/
│   ├── constants.py              # Game parameters, default prompt templates
│   ├── data_loader.py            # CSV → numpy payoff matrices
│   ├── agent.py                  # CyberWarAgent (Concordia Entity)
│   ├── controller.py             # Deterministic two-stage game loop
│   ├── analysis.py               # Nash equilibria, result aggregation, CoT metrics
│   ├── prompt_config.py          # PromptConfig dataclass + auto-discovery
│   ├── backends/
│   │   ├── gemini_backend.py     # Google Gemini 2.5 Flash
│   │   └── ollama_backend.py     # Local Ollama inference (deepseek-r1:14b)
│   ├── prompts/
│   │   ├── config_v1_rational_eut.py
│   │   ├── config_v2_bounded_satisficing.py
│   │   ├── config_v3_bounded_prospect_theory.py
│   │   ├── config_v4_irrational_hawkish.py
│   │   └── config_v5_irrational_retaliatory.py
│   └── constants/
│       ├── Sim 1 - Maxmin/       # 18 CSVs — defensive equilibrium payoffs
│       └── Sim1 - Minmax/        # 18 CSVs — aggressive equilibrium payoffs
├── results/
│   ├── v1_rational_eut/
│   │   ├── simulation_results.json
│   │   └── simulation_results_cot.json
│   ├── ... (v2–v5 same structure)
│   └── crossplay/
│       └── <configA>_vs_<configB>/   # 20 matchup directories
├── dashboard/
│   ├── src/                      # React source
│   └── public/data/              # Pre-built JSON served to the app
├── docs/                         # Extended technical documentation
└── info/                         # Reference papers
```

---

## CLI Reference

```bash
# Run all 5 symmetric configs (both concepts)
python3 main.py --backend ollama

# Single config, single concept
python3 main.py --config v1_rational_eut --concept maxmin

# Cross-play: one specific matchup
python3 main.py --config-a v1_rational_eut --config-b v4_irrational_hawkish

# All 20 asymmetric cross-play matchups
python3 main.py --cross-play-asymmetric

# Enable Chain-of-Thought reasoning
python3 main.py --cross-play-asymmetric --cot

# Override Ollama model
OLLAMA_MODEL=llama3.2 python3 main.py
```

| Argument | Default | Description |
|----------|---------|-------------|
| `--backend` | `ollama` | LLM backend: `ollama` or `gemini` |
| `--runs` | `1` | Independent runs per concept |
| `--concept` | both | `maxmin`, `minmax`, or both |
| `--config` | all | Specific config name(s) for symmetric mode |
| `--config-a` / `--config-b` | — | Configs for cross-play (must be paired) |
| `--cross-play` | — | All 25 matchups (including mirror controls) |
| `--cross-play-asymmetric` | — | 20 asymmetric matchups only |
| `--cot` | — | Enable Chain-of-Thought reasoning |

---

## Academic Foundation

Based on *"Robust Cyber Warfare: Private Actors, States, or Coalitions?"*, which models cyber conflict using game-theoretic payoff matrices parameterised by operational success, cost, escalation risk, attribution likelihood, and threat credibility. The payoff CSVs are pre-computed from these formulas — the simulation loads them directly.

See `docs/` for extended theoretical background and CSV structure documentation.
