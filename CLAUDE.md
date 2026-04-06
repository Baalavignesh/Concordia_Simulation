# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A two-stage cyber warfare wargame simulation built on Google DeepMind's Concordia framework. Two LLM-backed agents (Country A and Country B) play a game-theoretic wargame based on the paper "Robust Cyber Warfare: Private Actors, States, or Coalitions?". The simulation observes whether LLM agents' strategic decisions align with analytical equilibria from formal game theory.

## Commands

```bash
# Install dependencies
pip install gdm-concordia google-genai

# Run full simulation (default: Ollama backend, 1 run, both maxmin+minmax)
python3 main.py

# Quick test: single concept
python3 main.py --concept maxmin

# Run with Gemini
python3 main.py --backend gemini

# Run specific prompt configs only
python3 main.py --config v1_rational_eut v3_bounded_prospect_theory

# Cross-play: different persona per agent
python3 main.py --config-a v2_bounded_satisficing --config-b v1_rational_eut

# All 20 asymmetric cross-play matchups
python3 main.py --cross-play-asymmetric

# All 25 matchups (including mirror controls)
python3 main.py --cross-play

# Override Ollama model
OLLAMA_MODEL=mistral python3 main.py --backend ollama
```

## Environment Variables

- `GEMINI_API_KEY` — required for Gemini backend (also read from `.env` file)
- `OLLAMA_MODEL` — override default Ollama model (default: `deepseek-r1:14b`)

## Architecture

**Deterministic controller + LLM agents pattern:** Game logic (turn order, payoff lookup, termination) is handled by a Python controller, not an LLM Game Master. LLM calls are reserved only for the agents' strategic decisions. This avoids wasting LLM calls on predetermined game management.

### Two-Stage Game Flow

1. **Stage 1 (9 subgames):** For each of 9 mode combinations (P/S/C × P/S/C), both agents simultaneously choose Attack (R) or Threaten (Th). Payoffs come from pre-computed CSV matrices.
2. **Stage 2 (meta-game):** Realized payoffs populate a 3×3 matrix. Each agent chooses an overall attack mode (P, S, or C).

### Key Components

- **`main.py`** — CLI entrypoint. Discovers prompt configs from `src/prompts/`, runs simulations (symmetric or cross-play), saves results.
  - `run_simulation_for_config()` — symmetric mode (both agents share one config)
  - `run_crossplay_simulation()` — asymmetric mode (different config per agent)
- **`src/controller.py`** (`CyberWargameController`) — Deterministic game loop. Accepts `prompt_config` (for A) and optional `prompt_config_b` (for B). Sends per-agent observations, creates per-agent ActionSpecs, looks up payoffs, determines world state.
- **`src/agent.py`** (`CyberWarAgent`) — Concordia `Entity` implementation. Maintains observation memory (last 10 used as context). Delegates decisions to LLM via `sample_choice()`.
- **`src/prompt_config.py`** (`PromptConfig`) — Loads prompt template variants from `src/prompts/config_*.py` files. Each config defines a different decision-making persona (rational, satisficing, prospect-theory, hawkish, retaliatory).
- **`src/constants.py`** — All game parameters, mode/action definitions, and default prompt templates with documented placeholders.
- **`src/backends/`** — Pluggable LLM backends implementing Concordia's `LanguageModel` ABC. `GeminiBackend` (uses `google-genai` SDK) and `OllamaBackend` (local inference, default).
- **`src/data_loader.py`** — Reads CSV payoff matrices into `(player, mode_a, mode_b) → 2×2 numpy array` dict.
- **`src/analysis.py`** — Post-simulation analysis: computes analytical Nash equilibria, aggregates LLM decisions across runs, compares to theory. Config-agnostic (works for both symmetric and cross-play).

### Cross-Play (Asymmetric Matchups)

The controller supports per-agent prompt configs. In cross-play mode:
- Each agent gets their own config's game context, observations, call-to-action, and outcome templates
- Separate `ActionSpec` objects are created per agent (so each gets persona-appropriate framing)
- Results are saved to `results/crossplay/<configA>_vs_<configB>/` with `"cross_play": true` metadata
- The `analysis.py` functions are config-agnostic and work unchanged

CLI flags: `--config-a`/`--config-b` for one pair, `--cross-play` for all 25, `--cross-play-asymmetric` for 20 non-mirror pairs.

### Prompt Config System

Prompt configs in `src/prompts/config_*.py` define all prompt templates as module-level constants (e.g., `GAME_CONTEXT_TEMPLATE`, `AGENT_CHOICE_PROMPT`). They are auto-discovered by `discover_prompt_configs()` and loaded via `importlib`. Each config must define all 9 required constants listed in `_FIELD_MAP` in `prompt_config.py`.

### Dependency Flow (no circular imports)

```
constants ← data_loader ← controller ← main.py
                           ↑
backends/ (concordia only) agent (concordia + constants)
                           ↑
                      prompt_config
```

### Data Layout

Payoff matrices live in `src/constants/`:
- `Sim 1 - Maxmin/` — 18 CSVs (9 for A, 9 for B), defensive equilibrium
- `Sim1 - Minmax/` — 18 CSVs with `_d` suffix, aggressive equilibrium

File naming: `matrix_for_{A|B}_{modeA}{modeB}[_d].csv`. Each CSV is a 2×2 matrix where rows = [R, Th], columns = [opponent_R, opponent_Th].

### Key Design Decisions

- **Fresh agents per run** — no memory carryover between runs, ensuring independent observations.
- **Full information** — agents see complete payoff matrices, matching the theoretical model's assumption.
- **Risk orientation via prompting** — "risk-averse (defensive)" for maxmin, "risk-seeking (aggressive)" for minmax.
- **Results** — symmetric: `results/<config_name>/`, cross-play: `results/crossplay/<configA>_vs_<configB>/`.

### Dashboard

React app in `dashboard/` for visualizing results. Supports both symmetric configs and cross-play matchups.
- Cross-play data is loaded from `/data/crossplay/<matchup_id>.json`
- The Cross-Play page shows a payoff heatmap matrix and per-matchup detail drill-down
