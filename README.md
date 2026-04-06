# Cyber Warfare Wargame Simulation

A two-stage strategic cyber conflict simulation built on [Google DeepMind's Concordia](https://github.com/google-deepmind/concordia) framework. Two LLM-backed agents (Country A and Country B) play a game-theoretic wargame derived from the academic paper *"Robust Cyber Warfare: Private Actors, States, or Coalitions?"*.

The simulation asks: **when LLM agents reason about strategic trade-offs, do their decisions align with the analytical equilibria from formal game theory?**

---

## The Game

Two countries are engaged in a cyber conflict. Each must choose:

1. **An attack mode** -- *how* to conduct operations
2. **An action type** -- *what* to do

### Attack Modes

| Mode | Description |
|------|-------------|
| **Private Actor (P)** | Lowest cost, highest success rate, lowest escalation/attribution risk, but lowest threat credibility |
| **State Unit (S)** | Highest cost, lower success, highest escalation/attribution risk, but highest threat credibility |
| **Coalition (C)** | Shared cost, moderate success, highest escalation risk, moderate attribution and credibility |

### Action Types

| Action | Formula | Description |
|--------|---------|-------------|
| **Attack (R)** | `pi = (v-c)(1-beta)/(1-alpha)` | Execute the cyber operation. Higher impact, carries escalation and attribution risks |
| **Threaten (Th)** | `pi = (v-c) * gamma` | Threaten without executing. Lower risk, depends on threat credibility |

Where `v` = operational success, `c` = cost, `alpha` = escalation risk, `beta` = attribution likelihood, `gamma` = threat credibility.

### Two-Stage Structure

**Stage 1 -- Nine 2x2 Subgames:**
For every combination of Country A's mode and Country B's mode (3 x 3 = 9), both players simultaneously choose Attack (R) or Threaten (Th). Payoffs are looked up from pre-computed CSV matrices.

```
         B=P       B=S       B=C
A=P    [PP game]  [PS game]  [PC game]
A=S    [SP game]  [SS game]  [SC game]
A=C    [CP game]  [CS game]  [CC game]
```

**Stage 2 -- The 3x3 Meta-Game:**
The 9 realized payoffs populate a 3x3 matrix. Each player then chooses their overall attack mode (P, S, or C). The final payoff comes from the meta-game cell corresponding to both players' choices.

### Solution Concepts

The simulation runs under two strategic mindsets:

- **Maxmin (Defensive):** Each player maximizes their worst-case payoff. *"What's the best I can guarantee regardless of what my opponent does?"*
- **Minmax (Aggressive):** Each player minimizes the opponent's best-case payoff. *"How can I make things worst for my opponent?"*

### World States

The final outcome is classified as:

| Both Threaten | **Mutual Deterrence** -- threats remain more valuable than attacks |
|---|---|
| Both Attack | **Mutual Conflict** -- diminished returns for further attacks |
| One Attacks, One Threatens | **Asymmetric** -- threats gain credibility, attacks lose value |

---

## Prompt Configurations

The simulation tests **5 different decision-making personas** to see how cognitive framing affects strategic behavior:

| Config | Persona | Description |
|--------|---------|-------------|
| `v1_rational_eut` | Rational (EUT) | Perfect expected utility maximizer. Computes Nash equilibria, uses backward induction, no biases |
| `v2_bounded_satisficing` | Bounded Rational (Simon) | Satisficer. Sets "good enough" thresholds, uses heuristics, limited memory |
| `v3_bounded_prospect_theory` | Bounded Rational (Prospect Theory) | Loss-averse. Losses loom 2x larger, overweights small probabilities, reference-dependent |
| `v4_irrational_hawkish` | Irrational (Hawkish) | Overconfident aggressor. Overestimates own success, underestimates opponent, prefers Attack |
| `v5_irrational_retaliatory` | Irrational (Retaliatory) | Emotion-driven. Retaliates against aggression, mirrors/punishes opponent, neglects own payoffs |

Each config defines all prompt templates (game context, subgame observations, calls-to-action, agent identity) to steer the LLM into that persona.

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
- Game rules are enforced by a deterministic Python controller, not an LLM Game Master. Turn order, payoff lookup, and termination are all fixed -- LLM calls are reserved only for the agents' strategic decisions.
- **Cross-play support:** The controller accepts separate prompt configs per agent. Each agent receives its own persona-appropriate game context, observations, call-to-action framing, and outcome messaging. This lets a "rational maximizer" agent play against a "hawkish aggressor" agent, each seeing the game through their own cognitive lens.

The project uses three pieces from Concordia:
1. **`LanguageModel`** -- abstract interface for swapping LLM backends
2. **`Entity`** -- standardized agent with `observe()`/`act()` methods
3. **`ActionSpec`** -- structured multiple-choice requests with constrained outputs

---

## Setup

### Prerequisites

- Python 3.12+

### Install Dependencies

```bash
pip install gdm-concordia google-genai
```

### Configure LLM Backend

**Option A: Google Gemini (default, free tier)**

Get a free API key at https://aistudio.google.com/apikey and add it to a `.env` file:

```
GEMINI_API_KEY=your-key-here
```

**Option B: Ollama (free, local)**

```bash
brew install ollama           # macOS
ollama serve                  # start server (separate terminal)
ollama pull llama3.2          # pull a model
pip install ollama            # Python client
```

---

## Usage

### Symmetric Mode (same persona for both agents)

```bash
# Run all 5 prompt configs, both concepts
python3 main.py

# Quick test: single config, one concept
python3 main.py --config v1_rational_eut --concept maxmin

# Use Ollama instead of Gemini
python3 main.py --backend ollama

# Run specific configs
python3 main.py --config v1_rational_eut v4_irrational_hawkish
```

### Cross-Play Mode (different persona per agent)

Pit different cognitive profiles against each other. Country A uses one persona, Country B uses another.

```bash
# One specific matchup: Satisficing (A) vs Rational EUT (B)
python3 main.py --config-a v2_bounded_satisficing --config-b v1_rational_eut

# All 20 asymmetric matchups (skip mirror pairs)
python3 main.py --cross-play-asymmetric

# All 25 matchups (including mirrors as controls)
python3 main.py --cross-play

# Cross-play with specific concept
python3 main.py --config-a v4_irrational_hawkish --config-b v5_irrational_retaliatory --concept maxmin
```

Cross-play results are saved to `results/crossplay/<configA>_vs_<configB>/`.

### All 20 Asymmetric Matchup Combinations

| # | Country A (Persona) | Country B (Persona) |
|---|---------------------|---------------------|
| 1 | Rational (EUT) | Bounded Satisficing |
| 2 | Rational (EUT) | Prospect Theory |
| 3 | Rational (EUT) | Hawkish |
| 4 | Rational (EUT) | Retaliatory |
| 5 | Bounded Satisficing | Rational (EUT) |
| 6 | Bounded Satisficing | Prospect Theory |
| 7 | Bounded Satisficing | Hawkish |
| 8 | Bounded Satisficing | Retaliatory |
| 9 | Prospect Theory | Rational (EUT) |
| 10 | Prospect Theory | Bounded Satisficing |
| 11 | Prospect Theory | Hawkish |
| 12 | Prospect Theory | Retaliatory |
| 13 | Hawkish | Rational (EUT) |
| 14 | Hawkish | Bounded Satisficing |
| 15 | Hawkish | Prospect Theory |
| 16 | Hawkish | Retaliatory |
| 17 | Retaliatory | Rational (EUT) |
| 18 | Retaliatory | Bounded Satisficing |
| 19 | Retaliatory | Prospect Theory |
| 20 | Retaliatory | Hawkish |

Note: "A=EUT vs B=Hawkish" is **not** the same as "A=Hawkish vs B=EUT" because the payoff matrices are asymmetric between Country A and Country B.

### CLI Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--backend` | `ollama` | LLM backend: `gemini` or `ollama` |
| `--runs` | `1` | Number of independent runs per solution concept |
| `--concept` | `maxmin minmax` | Solution concepts to simulate (space-separated) |
| `--config` | all | Specific config names to run in symmetric mode |
| `--config-a` | -- | Config for Country A (cross-play; requires `--config-b`) |
| `--config-b` | -- | Config for Country B (cross-play; requires `--config-a`) |
| `--cross-play` | -- | Run all 25 matchups (including mirror controls) |
| `--cross-play-asymmetric` | -- | Run only 20 asymmetric matchups |
| `--cot` | -- | Enable Chain-of-Thought reasoning |

### Environment Variables

| Variable | Backend | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | gemini | API key (also read from `.env`) |
| `OLLAMA_MODEL` | ollama | Override default model (default: `deepseek-r1:14b`) |

---

## Output

### Results

**Symmetric runs** save to `results/<config_name>/simulation_results.json`.

**Cross-play runs** save to `results/crossplay/<configA>_vs_<configB>/simulation_results.json` with additional metadata:
```json
{
  "cross_play": true,
  "prompt_config_a": "v2_bounded_satisficing",
  "prompt_config_b": "v1_rational_eut",
  ...
}
```

Both formats contain:
- Per-run subgame choices and payoffs
- Meta-game mode selections and final payoffs
- World state classification
- Summary with analytical equilibria comparison

### Logs

Each simulation run creates a timestamped log file in `logs/simulation_YYYYMMDD_HHMMSS.log`. Runs are logged **immediately** after completion, so data is preserved even if the simulation crashes mid-config. After all runs for a config finish, an aggregate summary is appended with mode distributions, payoff stats, and Price of Aggression.

### Interpreting Results

- **Subgame consistency:** If an agent's choices align with the analytical dominant strategy across most runs, the LLM is reasoning correctly about payoffs.
- **Meta-game mode selection:** Compare majority mode against the paper's predicted equilibrium (Maxmin predicts (C, C); Minmax predicts (S, S)).
- **Price of Aggression:** `Lambda = pi_Defensive / pi_Aggressive`. Lambda > 1 means the defensive stance dominates -- aggression is costly.

---

## Project Structure

```
Concordia_Simulation/
    main.py                          # CLI entrypoint
    cyber_wargame.py                 # Original single-file version (reference)
    .env                             # GEMINI_API_KEY (not committed)
    src/
        constants.py                 # Game parameters, prompt templates
        data_loader.py               # CSV loading into numpy arrays
        agent.py                     # CyberWarAgent (Concordia Entity)
        controller.py                # Deterministic two-stage game loop
        analysis.py                  # Nash equilibria computation, result aggregation
        prompt_config.py             # PromptConfig dataclass, auto-discovery
        backends/
            gemini_backend.py        # Google Gemini 2.5 Flash (with retry)
            ollama_backend.py        # Local Ollama inference
        prompts/
            config_v1_rational_eut.py
            config_v2_bounded_satisficing.py
            config_v3_bounded_prospect_theory.py
            config_v4_irrational_hawkish.py
            config_v5_irrational_retaliatory.py
        constants/                   # Payoff matrix CSV data
            Sim 1 - Maxmin/          # 18 CSVs (defensive equilibrium)
            Sim1 - Minmax/           # 18 CSVs (aggressive equilibrium)
    results/                         # Simulation output (per config)
        crossplay/                   # Cross-play asymmetric matchup results
    logs/                            # Timestamped log files
    dashboard/                       # React dashboard for visualization
    docs/
        README.md                    # Detailed technical documentation
        CONCORDIA_USAGE.md           # How Concordia is used in this project
        CSV_STRUCTURE.md             # Guide to reading the payoff CSVs
        README_PD_vs_CyberWarfare.md # Why domain payoffs instead of PD
    info/
        Cyber_war___Strategies_and_Deterrence.pdf  # Source academic paper
```

---

## Academic Foundation

Based on *"Robust Cyber Warfare: Private Actors, States, or Coalitions?"* which models cyber conflict using game-theoretic payoff matrices parameterized by operational success, cost, escalation risk, attribution likelihood, and threat credibility. The payoff CSVs are pre-computed from these formulas -- the simulation loads them directly.

See `docs/README.md` for the full theoretical background and `docs/CSV_STRUCTURE.md` for details on reading the payoff matrices.
