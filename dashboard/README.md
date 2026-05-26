# Simulation Results Dashboard

A React/Vite application for visualising the Cyber Warfare Wargame simulation results.

## Pages

- **Symmetric Results** — per-config analysis: subgame choice distributions, meta-game mode selection, Nash equilibrium alignment, and Price of Aggression
- **Cross-Play Matrix** — 5×5 heatmap of all asymmetric matchups; click any cell to drill into that matchup's subgame and meta-game results
- **CoT Complexity** — Chain-of-Thought reasoning metrics (word count, opponent modelling, dominance recognition) across personas and solution concepts

## Running

```bash
# From the repo root
cd dashboard
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

> The dashboard reads pre-built JSON from `public/data/`. If you run new simulations, copy the updated results using `copy_results.sh` from the repo root before restarting the dev server.

## Data Layout

```
public/data/
├── v1_rational_eut.json              # Symmetric result, Rational EUT
├── v1_rational_eut_cot.json          # Same run with Chain-of-Thought
├── v2_bounded_satisficing.json
├── ...
├── crossplay/
│   ├── v1_rational_eut_vs_v2_bounded_satisficing.json
│   └── ... (20 asymmetric matchup files)
└── cot_complexity_analysis.json      # Aggregated CoT metrics
```
