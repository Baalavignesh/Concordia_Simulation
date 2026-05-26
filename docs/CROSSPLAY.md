# Cross-Play: Asymmetric Agent Matchups

## What Changed

Previously, both Country A and Country B always used the **same** prompt config (persona). A simulation run was always "EUT vs EUT" or "Hawkish vs Hawkish".

Now the simulation supports **cross-play** -- each agent can use a different cognitive profile. This lets us answer questions like: *"What happens when a perfectly rational agent plays against an emotionally retaliatory one?"*

### Files Modified

| File | Change |
|------|--------|
| `src/controller.py` | New `prompt_config_b` parameter. Each agent now gets their own game context, observations, call-to-action ActionSpecs, and outcome messages from their respective config. |
| `main.py` | New `run_crossplay_simulation()` function. New CLI flags: `--config-a`, `--config-b`, `--cross-play`, `--cross-play-asymmetric`. Results save to `results/crossplay/`. |
| `dashboard/src/pages/CrossPlay.jsx` | New page: payoff heatmap matrix + per-matchup drill-down. |
| `dashboard/src/utils/constants.js` | Added `CROSSPLAY_MATCHUPS` array and `getConfigById()` helper. |
| `dashboard/src/utils/dataLoader.js` | Loads cross-play JSON from `/data/crossplay/`. |
| `dashboard/src/App.jsx` | Added "Cross-Play" nav tab and route. |

### Files NOT Modified

| File | Why |
|------|-----|
| `src/agent.py` | Already receives per-agent prompt templates via constructor args. |
| `src/analysis.py` | Already config-agnostic -- `build_summary()` only looks at actions and payoffs. |
| `src/prompt_config.py` | `PromptConfig` dataclass is sufficient as-is. |
| `src/prompts/config_*.py` | No changes to persona definitions. |

---

## How It Works

In symmetric mode, both agents share one `PromptConfig`:

```
Controller receives: prompt_config = EUT
  -> Agent A gets EUT's game context, observations, call-to-action
  -> Agent B gets EUT's game context, observations, call-to-action
```

In cross-play mode, each agent gets their own:

```
Controller receives: prompt_config = EUT, prompt_config_b = Hawkish
  -> Agent A gets EUT's game context, observations, call-to-action
  -> Agent B gets Hawkish's game context, observations, call-to-action
```

The persona flavor is embedded in **all** templates, not just the agent's choice prompt. For example:
- EUT's call-to-action says: *"Apply strict expected utility maximization"*
- Satisficing's call-to-action says: *"Don't overthink it -- go with the option that seems good enough"*
- Hawkish's call-to-action says: *"Remember: strength deters. Attack from a position of dominance"*

So in cross-play, Agent A and Agent B receive completely different framings of the same game state.

---

## The 5 Player Types

| Short | Config Name | Persona | Decision Style |
|-------|-------------|---------|----------------|
| V1 | `v1_rational_eut` | Rational (EUT) | Computes expected utilities, finds Nash equilibria, backward induction |
| V2 | `v2_bounded_satisficing` | Bounded Satisficing | Sets "good enough" thresholds, heuristics, limited memory |
| V3 | `v3_bounded_prospect_theory` | Prospect Theory | Loss-averse (2x), overweights small probabilities, reference-dependent |
| V4 | `v4_irrational_hawkish` | Hawkish | Overconfident, assumes opponent is weak, prefers attack |
| V5 | `v5_irrational_retaliatory` | Retaliatory | Emotional, punishes aggression, mirrors opponent, honor-driven |

---

## Full 5x5 Matchup Grid

The rows represent Country A's persona, columns represent Country B's persona.

```
          B=V1(EUT)  B=V2(Sat)  B=V3(PT)   B=V4(Hawk)  B=V5(Ret)
A=V1(EUT)   mirror      1          2          3           4
A=V2(Sat)     5       mirror       6          7           8
A=V3(PT)      9         10       mirror      11          12
A=V4(Hawk)   13         14        15        mirror       16
A=V5(Ret)    17         18        19         20         mirror
```

- **Mirror cells** (diagonal): Both agents share the same persona. These already exist as symmetric runs, but `--cross-play` includes them as controls.
- **Off-diagonal cells**: The 20 asymmetric matchups. Order matters -- A=EUT vs B=Hawkish is different from A=Hawkish vs B=EUT because the payoff matrices are different for Country A and Country B.

### All 20 Asymmetric Matchups

| #  | Country A | Country B | CLI Command |
|----|-----------|-----------|-------------|
| 1  | Rational (EUT) | Bounded Satisficing | `--config-a v1_rational_eut --config-b v2_bounded_satisficing` |
| 2  | Rational (EUT) | Prospect Theory | `--config-a v1_rational_eut --config-b v3_bounded_prospect_theory` |
| 3  | Rational (EUT) | Hawkish | `--config-a v1_rational_eut --config-b v4_irrational_hawkish` |
| 4  | Rational (EUT) | Retaliatory | `--config-a v1_rational_eut --config-b v5_irrational_retaliatory` |
| 5  | Bounded Satisficing | Rational (EUT) | `--config-a v2_bounded_satisficing --config-b v1_rational_eut` |
| 6  | Bounded Satisficing | Prospect Theory | `--config-a v2_bounded_satisficing --config-b v3_bounded_prospect_theory` |
| 7  | Bounded Satisficing | Hawkish | `--config-a v2_bounded_satisficing --config-b v4_irrational_hawkish` |
| 8  | Bounded Satisficing | Retaliatory | `--config-a v2_bounded_satisficing --config-b v5_irrational_retaliatory` |
| 9  | Prospect Theory | Rational (EUT) | `--config-a v3_bounded_prospect_theory --config-b v1_rational_eut` |
| 10 | Prospect Theory | Bounded Satisficing | `--config-a v3_bounded_prospect_theory --config-b v2_bounded_satisficing` |
| 11 | Prospect Theory | Hawkish | `--config-a v3_bounded_prospect_theory --config-b v4_irrational_hawkish` |
| 12 | Prospect Theory | Retaliatory | `--config-a v3_bounded_prospect_theory --config-b v5_irrational_retaliatory` |
| 13 | Hawkish | Rational (EUT) | `--config-a v4_irrational_hawkish --config-b v1_rational_eut` |
| 14 | Hawkish | Bounded Satisficing | `--config-a v4_irrational_hawkish --config-b v2_bounded_satisficing` |
| 15 | Hawkish | Prospect Theory | `--config-a v4_irrational_hawkish --config-b v3_bounded_prospect_theory` |
| 16 | Hawkish | Retaliatory | `--config-a v4_irrational_hawkish --config-b v5_irrational_retaliatory` |
| 17 | Retaliatory | Rational (EUT) | `--config-a v5_irrational_retaliatory --config-b v1_rational_eut` |
| 18 | Retaliatory | Bounded Satisficing | `--config-a v5_irrational_retaliatory --config-b v2_bounded_satisficing` |
| 19 | Retaliatory | Prospect Theory | `--config-a v5_irrational_retaliatory --config-b v3_bounded_prospect_theory` |
| 20 | Retaliatory | Hawkish | `--config-a v5_irrational_retaliatory --config-b v4_irrational_hawkish` |

---

## Results Format

Cross-play results are saved to `results/crossplay/<configA>_vs_<configB>/simulation_results.json`:

```json
{
  "cross_play": true,
  "prompt_config_a": "v2_bounded_satisficing",
  "prompt_config_b": "v1_rational_eut",
  "backend": "ollama",
  "num_runs": 1,
  "timestamp": "2026-04-06T...",
  "maxmin": {
    "runs": [
      {
        "subgames": {
          "PP": { "action_a": "Th", "action_b": "R", "payoff_a": 0.1234, "payoff_b": 0.5678, ... },
          ...
        },
        "meta_game": { "mode_a": "C", "mode_b": "S", "payoff_a": ..., "payoff_b": ..., ... },
        "world_state": "Asymmetric (A threatens, B attacks)",
        "run_number": 1
      }
    ],
    "summary": { ... }
  },
  "minmax": { ... },
  "price_of_aggression": { "A": 1.234, "B": 0.987 }
}
```

The per-run data structure is identical to symmetric runs. The only difference is the top-level metadata (`cross_play`, `prompt_config_a`, `prompt_config_b` instead of `prompt_config`).

---

## Dashboard

The React dashboard has a new **Cross-Play** tab showing:

1. **Payoff heatmap matrix** -- 5x5 grid with A's mean payoff in each cell. Click any cell to drill down.
2. **Matchup detail panel** -- subgame results table, meta-game matrix, world state distribution, mode choice distribution.

To load cross-play data into the dashboard, copy result files:

```bash
# After running simulations
cp results/crossplay/v2_bounded_satisficing_vs_v1_rational_eut/simulation_results.json \
   dashboard/public/data/crossplay/v2_bounded_satisficing_vs_v1_rational_eut.json
```

---

## Quick Start

```bash
# Run one matchup
python3 main.py --config-a v2_bounded_satisficing --config-b v1_rational_eut --concept maxmin

# Run all 20 asymmetric matchups
python3 main.py --cross-play-asymmetric

# Run everything (25 matchups including mirrors)
python3 main.py --cross-play
```
