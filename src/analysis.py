"""Post-simulation analysis and game-theoretic comparison."""

import numpy as np

from src.constants import ACTIONS, MODE_NAMES, MODES


def compute_analytical_equilibria(matrices: dict) -> dict:
    """Compute analytical Nash equilibria for each subgame using dominant strategy."""
    equilibria = {}
    for mode_a in MODES:
        for mode_b in MODES:
            key = f"{mode_a}{mode_b}"
            mat_a = matrices.get(("A", mode_a, mode_b))
            mat_b = matrices.get(("B", mode_a, mode_b))
            if mat_a is None or mat_b is None:
                continue

            # Find best response for A given each B action
            a_br_vs_r = ACTIONS[np.argmax(mat_a[:, 0])]   # A's BR when B plays R
            a_br_vs_th = ACTIONS[np.argmax(mat_a[:, 1])]   # A's BR when B plays Th

            # Find best response for B given each A action
            b_br_vs_r = ACTIONS[np.argmax(mat_b[0, :])]    # B's BR when A plays R
            b_br_vs_th = ACTIONS[np.argmax(mat_b[1, :])]    # B's BR when A plays Th

            # Check for pure strategy Nash equilibria
            nash = []
            for i, a_act in enumerate(ACTIONS):
                for j, b_act in enumerate(ACTIONS):
                    a_is_br = (mat_a[i, j] >= mat_a[1 - i, j])
                    b_is_br = (mat_b[i, j] >= mat_b[i, 1 - j])
                    if a_is_br and b_is_br:
                        nash.append((a_act, b_act))

            # Dominant strategies
            a_dominant = a_br_vs_r if a_br_vs_r == a_br_vs_th else None
            b_dominant = b_br_vs_r if b_br_vs_r == b_br_vs_th else None

            equilibria[key] = {
                "a_br_vs_r": a_br_vs_r,
                "a_br_vs_th": a_br_vs_th,
                "b_br_vs_r": b_br_vs_r,
                "b_br_vs_th": b_br_vs_th,
                "nash_equilibria": nash,
                "a_dominant": a_dominant,
                "b_dominant": b_dominant,
            }
    return equilibria


def analyze_results(
    all_runs: list[dict],
    matrices: dict,
    solution_concept: str,
) -> str:
    """Analyze simulation results across all runs."""
    lines = [
        f"\n{'='*70}",
        f"  RESULTS ANALYSIS - {solution_concept.upper()} ({len(all_runs)} runs)",
        f"{'='*70}",
    ]

    # Analytical equilibria
    eq = compute_analytical_equilibria(matrices)

    # Subgame analysis
    lines.append("\n--- Subgame Results ---")
    for mode_a in MODES:
        for mode_b in MODES:
            key = f"{mode_a}{mode_b}"
            a_actions = [r["subgames"][key]["action_a"] for r in all_runs if key in r["subgames"]]
            b_actions = [r["subgames"][key]["action_b"] for r in all_runs if key in r["subgames"]]

            a_r_count = a_actions.count("R")
            a_th_count = a_actions.count("Th")
            b_r_count = b_actions.count("R")
            b_th_count = b_actions.count("Th")

            nash_str = ", ".join(
                [f"({n[0]},{n[1]})" for n in eq[key]["nash_equilibria"]]
            ) if eq[key]["nash_equilibria"] else "None (pure)"

            lines.append(
                f"\n  Subgame {key} ({MODE_NAMES[mode_a]} vs {MODE_NAMES[mode_b]}):"
            )
            lines.append(
                f"    Country A: R={a_r_count}/{len(a_actions)}, "
                f"Th={a_th_count}/{len(a_actions)} | "
                f"Dominant: {eq[key]['a_dominant'] or 'None'}"
            )
            lines.append(
                f"    Country B: R={b_r_count}/{len(b_actions)}, "
                f"Th={b_th_count}/{len(b_actions)} | "
                f"Dominant: {eq[key]['b_dominant'] or 'None'}"
            )
            lines.append(f"    Analytical Nash: {nash_str}")

    # Meta-game analysis
    lines.append("\n--- Meta-Game Results ---")
    a_modes = [r["meta_game"]["mode_a"] for r in all_runs]
    b_modes = [r["meta_game"]["mode_b"] for r in all_runs]
    world_states = [r["world_state"] for r in all_runs]

    for mode in MODES:
        a_count = a_modes.count(mode)
        b_count = b_modes.count(mode)
        lines.append(
            f"  Mode {mode} ({MODE_NAMES[mode]}): "
            f"A chose {a_count}/{len(a_modes)} times, "
            f"B chose {b_count}/{len(b_modes)} times"
        )

    lines.append("\n--- World States ---")
    for ws in set(world_states):
        count = world_states.count(ws)
        lines.append(f"  {ws}: {count}/{len(world_states)} runs")

    # Payoff summary
    lines.append("\n--- Payoff Summary ---")
    a_payoffs = [r["meta_game"]["payoff_a"] for r in all_runs]
    b_payoffs = [r["meta_game"]["payoff_b"] for r in all_runs]
    lines.append(
        f"  Country A: mean={np.mean(a_payoffs):.4f}, "
        f"std={np.std(a_payoffs):.4f}, "
        f"range=[{np.min(a_payoffs):.4f}, {np.max(a_payoffs):.4f}]"
    )
    lines.append(
        f"  Country B: mean={np.mean(b_payoffs):.4f}, "
        f"std={np.std(b_payoffs):.4f}, "
        f"range=[{np.min(b_payoffs):.4f}, {np.max(b_payoffs):.4f}]"
    )

    return "\n".join(lines)
