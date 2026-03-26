"""Post-simulation analysis and game-theoretic comparison."""

import re

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


def _analyze_reasoning_text(text: str) -> dict:
    """Extract complexity metrics from a single CoT reasoning trace."""
    if not text:
        return {}

    words = text.split()
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]

    # Step count: look for numbered steps, bullet points, or "Step N" patterns
    step_markers = re.findall(
        r'(?:^|\n)\s*(?:\d+[\.\):]|[-•*]|step\s+\d+)', text, re.IGNORECASE
    )
    step_count = len(step_markers)

    # Numerical references: how often the agent grounds reasoning in payoff values
    numeric_refs = re.findall(r'-?\d+\.?\d*', text)
    numeric_ref_count = len(numeric_refs)

    # Opponent modeling: does the agent consider what the other player does?
    opponent_keywords = [
        'opponent', 'other country', 'country a', 'country b',
        'they', 'their', 'adversary', 'rival',
    ]
    opponent_mentions = sum(
        len(re.findall(rf'\b{kw}\b', text, re.IGNORECASE))
        for kw in opponent_keywords
    )

    # Hedging / uncertainty language
    hedge_keywords = [
        'however', 'but', 'although', 'on the other hand',
        'uncertain', 'risk', 'might', 'could', 'possibly',
        'trade-off', 'tradeoff', 'depends',
    ]
    hedge_count = sum(
        len(re.findall(rf'\b{kw}\b', text, re.IGNORECASE))
        for kw in hedge_keywords
    )

    # Dominant strategy recognition
    dominance_keywords = [
        'dominant', 'dominates', 'strictly dominant',
        'always better', 'regardless',
    ]
    recognizes_dominance = any(
        re.search(rf'\b{kw}\b', text, re.IGNORECASE)
        for kw in dominance_keywords
    )

    # Comparison / deliberation: signs the agent weighed alternatives
    comparison_keywords = [
        'compare', 'versus', 'vs', 'better than', 'worse than',
        'higher', 'lower', 'prefer', 'alternative',
    ]
    comparison_count = sum(
        len(re.findall(rf'\b{kw}\b', text, re.IGNORECASE))
        for kw in comparison_keywords
    )

    return {
        "word_count": len(words),
        "sentence_count": len(sentences),
        "step_count": step_count,
        "numeric_references": numeric_ref_count,
        "opponent_mentions": opponent_mentions,
        "hedge_count": hedge_count,
        "recognizes_dominance": recognizes_dominance,
        "comparison_count": comparison_count,
    }


def analyze_cot_complexity(all_runs: list[dict]) -> dict | None:
    """Analyze CoT reasoning traces across all runs for complexity metrics.

    Returns None if no reasoning traces are found (non-CoT run).
    """
    # Check if reasoning data exists
    sample_sg = list(all_runs[0]["subgames"].values())[0]
    if "reasoning_a" not in sample_sg:
        return None

    subgame_complexity = {}
    for mode_a in MODES:
        for mode_b in MODES:
            key = f"{mode_a}{mode_b}"
            a_traces = []
            b_traces = []
            for r in all_runs:
                sg = r["subgames"].get(key, {})
                a_traces.append(_analyze_reasoning_text(sg.get("reasoning_a", "")))
                b_traces.append(_analyze_reasoning_text(sg.get("reasoning_b", "")))

            subgame_complexity[key] = {
                "A": _aggregate_trace_metrics(a_traces),
                "B": _aggregate_trace_metrics(b_traces),
            }

    # Meta-game reasoning
    meta_a_traces = [
        _analyze_reasoning_text(r["meta_game"].get("reasoning_a", ""))
        for r in all_runs
    ]
    meta_b_traces = [
        _analyze_reasoning_text(r["meta_game"].get("reasoning_b", ""))
        for r in all_runs
    ]

    # Compute overall complexity score per subgame (avg word count as proxy)
    complexity_ranking = []
    for key, data in subgame_complexity.items():
        avg_words = (
            data["A"]["word_count"]["mean"] + data["B"]["word_count"]["mean"]
        ) / 2
        complexity_ranking.append((key, round(avg_words, 1)))
    complexity_ranking.sort(key=lambda x: x[1], reverse=True)

    return {
        "subgames": subgame_complexity,
        "meta_game": {
            "A": _aggregate_trace_metrics(meta_a_traces),
            "B": _aggregate_trace_metrics(meta_b_traces),
        },
        "complexity_ranking": complexity_ranking,
    }


def _aggregate_trace_metrics(traces: list[dict]) -> dict:
    """Aggregate metrics across multiple traces into mean/std."""
    if not traces or not traces[0]:
        return {}

    result = {}
    for key in traces[0]:
        values = [t[key] for t in traces if key in t]
        if isinstance(values[0], bool):
            result[key] = round(sum(values) / len(values), 2)  # fraction true
        else:
            result[key] = {
                "mean": round(float(np.mean(values)), 2),
                "std": round(float(np.std(values)), 2),
            }
    return result
