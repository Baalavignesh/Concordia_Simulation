"""Post-simulation analysis and game-theoretic comparison."""

import numpy as np

from src.constants import ACTIONS, MODES


def compute_analytical_equilibria(matrices: dict) -> dict:
    """Compute analytical Nash equilibria for each subgame."""
    equilibria = {}
    for mode_a in MODES:
        for mode_b in MODES:
            key = f"{mode_a}{mode_b}"
            mat_a = matrices.get(("A", mode_a, mode_b))
            mat_b = matrices.get(("B", mode_a, mode_b))
            if mat_a is None or mat_b is None:
                continue

            a_br_vs_r = ACTIONS[np.argmax(mat_a[:, 0])]
            a_br_vs_th = ACTIONS[np.argmax(mat_a[:, 1])]
            b_br_vs_r = ACTIONS[np.argmax(mat_b[0, :])]
            b_br_vs_th = ACTIONS[np.argmax(mat_b[1, :])]

            nash = []
            for i, a_act in enumerate(ACTIONS):
                for j, b_act in enumerate(ACTIONS):
                    a_is_br = (mat_a[i, j] >= mat_a[1 - i, j])
                    b_is_br = (mat_b[i, j] >= mat_b[i, 1 - j])
                    if a_is_br and b_is_br:
                        nash.append([a_act, b_act])

            a_dominant = a_br_vs_r if a_br_vs_r == a_br_vs_th else None
            b_dominant = b_br_vs_r if b_br_vs_r == b_br_vs_th else None

            equilibria[key] = {
                "nash_equilibria": nash,
                "a_dominant": a_dominant,
                "b_dominant": b_dominant,
            }
    return equilibria


def build_summary(all_runs: list[dict], matrices: dict) -> dict:
    """Build a structured summary dict from simulation runs.

    Returns a dict with subgame stats, meta-game stats, and world state counts.
    """
    eq = compute_analytical_equilibria(matrices)

    # Subgame summary
    subgames = {}
    for mode_a in MODES:
        for mode_b in MODES:
            key = f"{mode_a}{mode_b}"
            a_actions = [r["subgames"][key]["action_a"] for r in all_runs if key in r["subgames"]]
            b_actions = [r["subgames"][key]["action_b"] for r in all_runs if key in r["subgames"]]

            subgames[key] = {
                "action_counts": {
                    "A": {"R": a_actions.count("R"), "Th": a_actions.count("Th")},
                    "B": {"R": b_actions.count("R"), "Th": b_actions.count("Th")},
                },
                "analytical": eq.get(key, {}),
            }

    # Meta-game summary
    a_modes = [r["meta_game"]["mode_a"] for r in all_runs]
    b_modes = [r["meta_game"]["mode_b"] for r in all_runs]
    a_payoffs = [r["meta_game"]["payoff_a"] for r in all_runs]
    b_payoffs = [r["meta_game"]["payoff_b"] for r in all_runs]

    meta_game = {
        "mode_counts": {
            "A": {m: a_modes.count(m) for m in MODES},
            "B": {m: b_modes.count(m) for m in MODES},
        },
        "payoffs": {
            "A": {"mean": round(float(np.mean(a_payoffs)), 4),
                   "std": round(float(np.std(a_payoffs)), 4)},
            "B": {"mean": round(float(np.mean(b_payoffs)), 4),
                   "std": round(float(np.std(b_payoffs)), 4)},
        },
    }

    # World state counts
    ws_counts: dict[str, int] = {}
    for r in all_runs:
        ws = r["world_state"]
        ws_counts[ws] = ws_counts.get(ws, 0) + 1

    return {
        "subgames": subgames,
        "meta_game": meta_game,
        "world_states": ws_counts,
    }
