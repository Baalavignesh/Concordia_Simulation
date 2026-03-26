#!/usr/bin/env python3
"""Standalone script to analyze CoT reasoning complexity from simulation results.

Usage:
    # Analyze all CoT result files in dashboard/public/data/
    python3 analyze_cot.py

    # Analyze specific files
    python3 analyze_cot.py dashboard/public/data/v1_rational_eut_cot.json

    # Custom output path
    python3 analyze_cot.py --output results/cot_analysis.json

Output is saved to dashboard/public/data/cot_complexity_analysis.json by default.
"""

import argparse
import json
from pathlib import Path

from src.analysis import analyze_cot_complexity

DEFAULT_DATA_DIR = Path("dashboard/public/data")
DEFAULT_OUTPUT = DEFAULT_DATA_DIR / "cot_complexity_analysis.json"


def analyze_file(filepath: Path) -> dict | None:
    """Run CoT complexity analysis on a single results JSON file."""
    with open(filepath) as f:
        data = json.load(f)

    config_name = data.get("prompt_config", filepath.stem)
    result = {"config": config_name, "concepts": {}}

    for concept in ["maxmin", "minmax"]:
        if concept not in data:
            continue
        runs = data[concept].get("runs", [])
        if not runs:
            continue
        analysis = analyze_cot_complexity(runs)
        if analysis is None:
            continue
        result["concepts"][concept] = analysis

    if not result["concepts"]:
        return None
    return result


def build_cross_config_comparison(all_analyses: list[dict]) -> dict:
    """Build comparison metrics across all configs."""
    comparison = {}

    for analysis in all_analyses:
        config = analysis["config"]
        comparison[config] = {}

        for concept, data in analysis["concepts"].items():
            # Avg word count across all subgames for both agents
            total_words = []
            total_opponent = []
            dominance_rates = []
            total_hedges = []
            total_comparisons = []

            for sg in data["subgames"].values():
                for player in ["A", "B"]:
                    metrics = sg[player]
                    total_words.append(metrics["word_count"]["mean"])
                    total_opponent.append(metrics["opponent_mentions"]["mean"])
                    dominance_rates.append(metrics["recognizes_dominance"])
                    total_hedges.append(metrics["hedge_count"]["mean"])
                    total_comparisons.append(metrics["comparison_count"]["mean"])

            n = len(total_words)
            comparison[config][concept] = {
                "avg_reasoning_length": round(sum(total_words) / n, 1),
                "avg_opponent_modeling": round(sum(total_opponent) / n, 2),
                "dominance_recognition_rate": round(sum(dominance_rates) / n, 2),
                "avg_hedge_count": round(sum(total_hedges) / n, 2),
                "avg_comparison_count": round(sum(total_comparisons) / n, 2),
                "hardest_subgame": data["complexity_ranking"][0][0],
                "easiest_subgame": data["complexity_ranking"][-1][0],
            }

    return comparison


def main():
    parser = argparse.ArgumentParser(description="Analyze CoT reasoning complexity")
    parser.add_argument(
        "files", nargs="*",
        help="Specific CoT result JSON files to analyze. "
             "If omitted, scans dashboard/public/data/ for *_cot.json files."
    )
    parser.add_argument(
        "--output", "-o", type=Path, default=DEFAULT_OUTPUT,
        help=f"Output path (default: {DEFAULT_OUTPUT})"
    )
    args = parser.parse_args()

    if args.files:
        cot_files = [Path(f) for f in args.files]
    else:
        cot_files = sorted(DEFAULT_DATA_DIR.glob("*_cot.json"))

    if not cot_files:
        print("No CoT result files found.")
        return

    print(f"Analyzing {len(cot_files)} CoT result file(s)...")

    all_analyses = []
    for filepath in cot_files:
        print(f"  {filepath.name}", end=" ")
        result = analyze_file(filepath)
        if result:
            all_analyses.append(result)
            concepts = list(result["concepts"].keys())
            print(f"-> {concepts}")
        else:
            print("-> skipped (no CoT data)")

    if not all_analyses:
        print("No CoT data found in any file.")
        return

    comparison = build_cross_config_comparison(all_analyses)

    output = {
        "configs": all_analyses,
        "cross_config_comparison": comparison,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nSaved to {args.output}")

    # Print summary table
    print("\n=== Cross-Config Summary ===")
    print(f"{'Config':<35} {'Concept':<8} {'Avg Words':>10} {'Dominance':>10} {'Opponent':>10} {'Hedging':>8}")
    print("-" * 90)
    for config, concepts in comparison.items():
        for concept, metrics in concepts.items():
            print(
                f"{config:<35} {concept:<8} "
                f"{metrics['avg_reasoning_length']:>10.1f} "
                f"{metrics['dominance_recognition_rate']:>9.0%} "
                f"{metrics['avg_opponent_modeling']:>10.1f} "
                f"{metrics['avg_hedge_count']:>8.1f}"
            )


if __name__ == "__main__":
    main()
