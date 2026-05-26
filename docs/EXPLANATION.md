# Complete Walkthrough: Cyber Wargame Simulation

This document explains how the simulation works from start to finish — where execution begins, how the game is structured, how agents make decisions, and how results are produced.

---

## Table of Contents

1. [What This App Does](#what-this-app-does)
2. [Entry Point: main.py](#entry-point-mainpy)
3. [Step 1: Parse Arguments and Discover Configs](#step-1-parse-arguments-and-discover-configs)
4. [Step 2: Load Prompt Configs](#step-2-load-prompt-configs)
5. [Step 3: Initialize LLM Backend](#step-3-initialize-llm-backend)
6. [Step 4: Run Simulations Per Config](#step-4-run-simulations-per-config)
7. [Step 5: Set Up a Single Run](#step-5-set-up-a-single-run)
8. [Step 6: Stage 1 — Play 9 Subgames](#step-6-stage-1--play-9-subgames)
9. [Step 7: Build the Meta-Game Matrix](#step-7-build-the-meta-game-matrix)
10. [Step 8: Stage 2 — Play the Meta-Game](#step-8-stage-2--play-the-meta-game)
11. [Step 9: Determine World State](#step-9-determine-world-state)
12. [Step 10: Analyze Results](#step-10-analyze-results)
13. [Step 11: Save Results](#step-11-save-results)
14. [How the Agent Makes Decisions](#how-the-agent-makes-decisions)
15. [LLM Backend: How Responses Are Parsed](#llm-backend-how-responses-are-parsed)
16. [The Five Prompt Configs](#the-five-prompt-configs)
17. [Data Files: Payoff Matrices](#data-files-payoff-matrices)
18. [Full Execution Summary](#full-execution-summary)

---

## What This App Does

Two LLM-backed agents (Country A and Country B) play a game-theoretic cyber warfare wargame. The game is based on the paper *"Robust Cyber Warfare: Private Actors, States, or Coalitions?"*. The goal is to observe whether LLM agents' strategic decisions align with the analytical equilibria predicted by formal game theory.

Each country must choose:
- An **attack mode**: Private Actor (P), State Unit (S), or Coalition (C)
- An **action**: Attack (R) or Threaten (Th)

The game plays out in two stages, and payoffs are determined by pre-computed matrices from the paper.

---

## Entry Point: main.py

Everything starts in `main.py`. When you run:

```bash
python3 main.py
```

The `main()` function at the bottom of the file kicks off the entire simulation pipeline.

---

## Step 1: Parse Arguments and Discover Configs

`main.py` first parses command-line arguments:

| Argument | Default | Purpose |
|----------|---------|---------|
| `--backend` | `gemini` | Which LLM to use (`gemini` or `ollama`) |
| `--runs` | `5` | Number of independent runs per config |
| `--concept` | both | Solution concept: `maxmin`, `minmax`, or both |
| `--config` | all | Specific prompt configs to run |
| `--cot` | off | Enable Chain-of-Thought reasoning |

Then it calls `discover_prompt_configs()` to scan the `src/prompts/` directory for all files matching `config_*.py`. Each file defines a different agent personality/decision model.

---

## Step 2: Load Prompt Configs

Each prompt config file (e.g., `src/prompts/config_v1_rational_eut.py`) defines 9 module-level string constants:

| Constant | Purpose |
|----------|---------|
| `GAME_CONTEXT_TEMPLATE` | Initial game briefing sent to agents |
| `SUBGAME_OBSERVATION_A` | Per-subgame context for Country A |
| `SUBGAME_OBSERVATION_B` | Per-subgame context for Country B |
| `SUBGAME_CALL_TO_ACTION` | The question that triggers a subgame decision |
| `SUBGAME_OUTCOME` | Feedback sent after each subgame |
| `META_GAME_HEADER` | Preamble to the 3x3 meta-game matrix |
| `META_GAME_CALL_TO_ACTION` | The question that triggers the meta-game decision |
| `AGENT_CHOICE_PROMPT` | Template for formatting choice prompts to the LLM |
| `AGENT_FREE_PROMPT` | Template for free-form (non-choice) prompts |

`load_prompt_config()` uses `importlib` to dynamically import the module and extract these constants into a `PromptConfig` dataclass.

---

## Step 3: Initialize LLM Backend

The `get_llm_backend()` factory function creates the appropriate backend:

- **GeminiBackend** (`src/backends/gemini_backend.py`): Uses the `google-genai` SDK with `gemini-2.5-flash`. Reads `GEMINI_API_KEY` from environment or `.env` file. Has retry logic (5 attempts with exponential backoff).
- **OllamaBackend**: For local LLM inference. Model configurable via `OLLAMA_MODEL` env var.

All backends implement Concordia's `LanguageModel` ABC, providing `sample_text()` and `sample_choice()` methods.

---

## Step 4: Run Simulations Per Config

For each prompt config, the app runs `run_simulation_for_config()`. This function loops over solution concepts (maxmin, minmax, or both):

```
For each prompt config (e.g., v1_rational_eut):
    For each solution concept (maxmin, minmax):
        Load the appropriate payoff matrices
        For each run (1 to 5):
            Create fresh agents (no memory carryover)
            Create controller
            Play the full game
            Log results
        Analyze results across all runs
```

**Key design**: Agents are created fresh for every run. No memory carries over between runs, ensuring each observation is statistically independent.

---

## Step 5: Set Up a Single Run

For one run, the controller (`CyberWargameController` in `src/controller.py`) does the following:

1. **Create two agents**: Each `CyberWarAgent` gets a name ("Country_A" / "Country_B"), a player ID, the LLM backend, and a risk orientation.
   - Maxmin concept → "risk-averse (defensive)"
   - Minmax concept → "risk-seeking (aggressive)"

2. **Load payoff matrices**:
   - Maxmin: from `src/constants/Sim 1 - Maxmin/` (18 CSV files)
   - Minmax: from `src/constants/Sim1 - Minmax/` (18 CSV files with `_d` suffix)

3. **Send game context**: The controller formats the `GAME_CONTEXT_TEMPLATE` with game parameters and sends it to both agents as their first observation. This tells them the rules, available modes, actions, and what they're optimizing for.

---

## Step 6: Stage 1 — Play 9 Subgames

This is the core of the simulation. The controller plays all 9 combinations of attack modes:

```
Country A mode × Country B mode:
  P vs P,  P vs S,  P vs C
  S vs P,  S vs S,  S vs C
  C vs P,  C vs S,  C vs C
```

For each subgame (e.g., P vs S):

### 6a. Load the 2x2 payoff matrix

Each subgame has two CSV files — one for each player's payoffs. Each CSV is a 2x2 matrix:

```
         Opponent plays R    Opponent plays Th
You play R    payoff[0,0]       payoff[0,1]
You play Th   payoff[1,0]       payoff[1,1]
```

### 6b. Send observations to agents

Each agent receives a subgame observation containing:
- The current mode matchup (e.g., "You are Private Actor, opponent is State Unit")
- Their own payoff matrix (agents see only their own payoffs)
- Mode descriptions (cost, success rate, escalation risk, etc.)

### 6c. Ask agents to choose

The controller creates a Concordia `ActionSpec` with output type `CHOICE` and the options `["R", "Th"]`. Each agent's `act()` method is called.

### 6d. Look up payoffs

Using the agents' choices, the controller indexes into the payoff matrices:

```python
row = ACTIONS.index(action_a)   # 0 for "R", 1 for "Th"
col = ACTIONS.index(action_b)   # 0 for "R", 1 for "Th"
payoff_a = matrix_a[row, col]
payoff_b = matrix_b[row, col]
```

### 6e. Send outcome

Both agents receive an observation about what happened — what each side chose and the resulting payoffs. This becomes part of their memory for future subgames.

### 6f. Store result

The subgame result is stored:
```python
{
    "mode_a": "P", "mode_b": "S",
    "action_a": "Th", "action_b": "R",
    "payoff_a": 0.705, "payoff_b": 0.9
}
```

---

## Step 7: Build the Meta-Game Matrix

After all 9 subgames are played, the controller builds a 3x3 meta-game matrix from the realized payoffs:

```
              Country B chooses:
               P          S          C
Country A  P [ PP_payoff  PS_payoff  PC_payoff ]
chooses:   S [ SP_payoff  SS_payoff  SC_payoff ]
           C [ CP_payoff  CS_payoff  CC_payoff ]
```

Each cell contains the payoff that was actually realized during the corresponding subgame. This is done separately for each player (A gets A's payoffs, B gets B's payoffs).

---

## Step 8: Stage 2 — Play the Meta-Game

Now each agent must choose their overall attack mode (P, S, or C) based on the 3x3 matrix of realized payoffs:

1. The controller formats the 3x3 matrix and sends it to each agent
2. Each agent sees only their own payoff grid
3. The controller asks: "Choose your attack mode: P, S, or C"
4. Each agent calls the LLM to decide
5. The controller looks up the final payoff from the meta-game matrix using both agents' mode choices

---

## Step 9: Determine World State

Based on the final mode choices and the corresponding subgame actions, the controller determines the world state:

| A's subgame action | B's subgame action | World State |
|--------------------|--------------------|-------------|
| Attack (R) | Attack (R) | Mutual Conflict |
| Threaten (Th) | Threaten (Th) | Mutual Deterrence |
| Attack (R) | Threaten (Th) | Asymmetric (A attacks, B threatens) |
| Threaten (Th) | Attack (R) | Asymmetric (A threatens, B attacks) |

---

## Step 10: Analyze Results

After all runs complete for a given concept, `analyze_results()` in `src/analysis.py` does two things:

### 10a. Compute Analytical Equilibria

For each of the 9 subgames, the analysis computes:
- Best responses for each player given each possible opponent action
- Dominant strategies (if a player's best response is the same regardless of opponent action)
- Pure strategy Nash equilibria (where both players are playing best responses simultaneously)

### 10b. Compare LLM Decisions to Theory

Across all runs, the analysis counts:
- How often each agent chose R vs Th in each subgame
- How often each agent chose P, S, or C in the meta-game
- Distribution of world states
- Mean, std, min, max payoffs for both players
- Whether LLM choices aligned with the computed Nash equilibria

### 10c. Price of Aggression

If both maxmin and minmax were run, the app computes:

```
Lambda_A = mean(maxmin_payoff_A) / mean(minmax_payoff_A)
Lambda_B = mean(maxmin_payoff_B) / mean(minmax_payoff_B)
```

- Lambda > 1: Defensive (maxmin) stance yields better payoffs
- Lambda < 1: Aggressive (minmax) stance yields better payoffs
- Lambda = 1: No difference

---

## Step 11: Save Results

Results are saved to `results/<config_name>/simulation_results.json` (or `simulation_results_cot.json` if Chain-of-Thought is enabled).

The JSON structure:

```json
{
  "prompt_config": "v1_rational_eut",
  "chain_of_thought": false,
  "maxmin": {
    "runs": [
      {
        "run_number": 1,
        "subgames": {
          "PP": { "mode_a": "P", "mode_b": "P", "action_a": "Th", "action_b": "R", "payoff_a": 0.9, "payoff_b": 0.0 },
          "PS": { ... },
          ...
        },
        "meta_game": {
          "mode_a": "P", "mode_b": "S",
          "payoff_a": 0.9, "payoff_b": -1.5,
          "meta_matrix_a": [[...], [...], [...]],
          "meta_matrix_b": [[...], [...], [...]]
        },
        "world_state": "Asymmetric (A attacks, B threatens)"
      },
      ...
    ],
    "analysis": "Full analysis text..."
  },
  "minmax": { ... }
}
```

---

## How the Agent Makes Decisions

The `CyberWarAgent` class (`src/agent.py`) implements Concordia's `Entity` interface.

### Memory

The agent maintains a list of all observations it has received. When making a decision, it uses the **last 10 observations** as context:

```python
context = "\n".join(self._observations[-10:])
```

This sliding window means the agent always has recent game history but doesn't get overwhelmed with too much context.

### Decision Flow

When `act(action_spec)` is called:

1. Get last 10 observations as context string
2. Format the choice prompt using the config's `AGENT_CHOICE_PROMPT` template, filling in:
   - `{agent_name}` — "Country_A" or "Country_B"
   - `{risk_orientation}` — "risk-averse (defensive)" or "risk-seeking (aggressive)"
   - `{context}` — the observation history
   - `{call_to_action}` — the specific question being asked
   - `{options}` — available choices (e.g., "R, Th")
3. Call the LLM backend's `sample_choice()` (or `sample_choice_cot()` if CoT is enabled)
4. The backend returns the matched option
5. Log the action and return it

### Chain-of-Thought Mode

When `--cot` is enabled, the agent uses `sample_choice_cot()` instead:

1. **Step 1 (Think)**: Ask the LLM to reason through the decision (higher token limit, moderate temperature)
2. **Step 2 (Choose)**: Ask the LLM to extract its final choice from the reasoning (low token limit, zero temperature)
3. The reasoning text is saved alongside the choice in the results

---

## LLM Backend: How Responses Are Parsed

The LLM doesn't always return clean single-word answers. The backend uses a three-tier matching system to parse responses:

| Tier | Method | Example |
|------|--------|---------|
| 1 | Exact match (case-insensitive) | LLM says "Th" → matches "Th" |
| 2 | Word-boundary regex | LLM says "I choose R because..." → matches "R" (but won't match "r" inside "there") |
| 3 | Alias expansion | LLM says "I'll Attack" → "Attack" maps to "R" via alias table |

Aliases include:
- "attack" → "R"
- "threaten" → "Th"
- "private actor" → "P"
- "state unit" → "S"
- "coalition" → "C"

---

## The Five Prompt Configs

Each config gives the agents a different decision-making personality:

### v1: Rational (Expected Utility Theory)
- Perfectly rational expected utility maximizer
- "Compute EU for all actions, find dominant strategies, use Nash equilibrium"
- "Do not use heuristics or intuition — compute precisely"

### v2: Bounded Satisficing
- Boundedly rational satisficer (Herbert Simon's model)
- "Set aspiration levels, search sequentially until a satisfactory payoff is found"
- "You don't need the optimal solution, just a good-enough one"

### v3: Bounded Prospect Theory
- Prospect theory agent with loss aversion (Kahneman & Tversky)
- "Losses hurt twice as much as gains feel good"
- Overweights tail risks, reference-dependent evaluation

### v4: Irrational Hawkish
- Hawkish bias toward aggression
- "You are overly confident in your ability to win"
- Overestimates own success rates, underestimates opponent's payoff

### v5: Irrational Retaliatory
- Emotional, punishment-seeking
- "If the opponent attacks, retaliate even if it's costly to you"
- Tracks opponent's past actions and seeks revenge

---

## Data Files: Payoff Matrices

Payoff matrices live in `src/constants/`:

```
src/constants/
├── Sim 1 - Maxmin/          # Defensive equilibrium matrices
│   ├── matrix_for_A_PP.csv   # Country A's payoffs when both play P
│   ├── matrix_for_B_PP.csv   # Country B's payoffs when both play P
│   ├── matrix_for_A_PS.csv   # Country A's payoffs: A=P, B=S
│   └── ... (18 files total)
│
└── Sim1 - Minmax/            # Aggressive equilibrium matrices
    ├── matrix_for_A_PP_d.csv  # Same structure, _d suffix
    └── ... (18 files total)
```

Each CSV contains a 2x2 matrix:
- Rows: Your action (R = Attack, Th = Threaten)
- Columns: Opponent's action (R, Th)
- Values: Your payoff for that action combination

---

## Full Execution Summary

Here's the complete flow in one view:

```
main.py starts
│
├── Parse CLI arguments (backend, runs, concept, config, cot)
├── Discover prompt configs from src/prompts/config_*.py
├── Initialize LLM backend (Gemini or Ollama)
│
└── For each prompt config:
    └── For each solution concept (maxmin / minmax):
        ├── Load payoff matrices from CSV files
        │
        └── For each run (1 to 5):
            ├── Create fresh Country A and Country B agents
            ├── Create controller with agents and matrices
            │
            ├── Send game context briefing to both agents
            │
            ├── STAGE 1: Play 9 subgames
            │   └── For each mode pair (PP, PS, PC, SP, SS, SC, CP, CS, CC):
            │       ├── Send subgame observation (payoff matrix) to each agent
            │       ├── Ask each agent: "Choose R or Th"
            │       ├── LLM decides for each agent
            │       ├── Look up payoffs from CSV matrices
            │       ├── Send outcome to both agents
            │       └── Store subgame result
            │
            ├── Build 3x3 meta-game matrix from realized payoffs
            │
            ├── STAGE 2: Play the meta-game
            │   ├── Send 3x3 matrix to each agent
            │   ├── Ask each agent: "Choose P, S, or C"
            │   ├── LLM decides for each agent
            │   └── Look up final payoffs
            │
            ├── Determine world state (Mutual Conflict / Deterrence / Asymmetric)
            └── Log run results
        │
        └── Analyze results across all runs
            ├── Compute analytical Nash equilibria
            ├── Compare LLM decisions to theory
            └── Aggregate statistics
    │
    ├── Compute Price of Aggression (if both concepts ran)
    └── Save to results/<config_name>/simulation_results.json
```

### LLM Call Count

Each run makes **20 LLM calls** (2 agents x 10 decisions each: 9 subgames + 1 meta-game).

A full default simulation (5 configs, 2 concepts, 5 runs) makes **1,000 LLM calls** total.

### Key Design Principles

1. **Deterministic controller, not LLM Game Master** — Game logic is Python code; LLMs only make strategic decisions
2. **Fresh agents per run** — No memory carryover ensures statistical independence
3. **Full information** — Agents see complete payoff matrices, matching the theoretical model
4. **Risk orientation via prompting** — The same game mechanics with different framing
5. **Pluggable backends** — Swap LLM providers without changing game logic
6. **Multi-tier response parsing** — Handles messy LLM outputs robustly
