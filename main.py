#!/usr/bin/env python3
"""CLI entrypoint for the Cyber Warfare Wargame Simulation."""

import json
from datetime import datetime
from pathlib import Path

import numpy as np

from src.agent import CyberWarAgent
from src.analysis import build_summary
from src.backends import get_llm_backend
from src.constants import BASE_DIR, MAXMIN_DIR, MINMAX_DIR, NUM_RUNS
from src.controller import CyberWargameController
from src.data_loader import load_payoff_matrices
from src.prompt_config import PromptConfig, discover_prompt_configs


PROMPTS_DIR = BASE_DIR / "src" / "prompts"
RESULTS_DIR = BASE_DIR / "results"


def run_simulation_for_config(
    prompt_config: PromptConfig,
    backend_name: str = "gemini",
    num_runs: int = NUM_RUNS,
    solution_concepts: list[str] | None = None,
    cot: bool = False,
) -> dict:
    """Run the full simulation for a single prompt config."""
    if solution_concepts is None:
        solution_concepts = ["maxmin", "minmax"]

    llm = get_llm_backend(backend_name)
    all_results = {}

    for concept in solution_concepts:
        if concept == "maxmin":
            matrices = load_payoff_matrices(MAXMIN_DIR)
        elif concept == "minmax":
            matrices = load_payoff_matrices(MINMAX_DIR, suffix="_d")
        else:
            raise ValueError(f"Unknown solution concept: {concept}")

        runs = []
        for run_num in range(1, num_runs + 1):
            print(f"  {prompt_config.name} | {concept} | run {run_num}/{num_runs}", flush=True)

            agent_a = CyberWarAgent(
                agent_name="Country_A",
                player_id="A",
                llm=llm,
                risk_orientation=(
                    "risk-averse (defensive)" if concept == "maxmin"
                    else "risk-seeking (aggressive)"
                ),
                choice_prompt_template=prompt_config.agent_choice_prompt,
                free_prompt_template=prompt_config.agent_free_prompt,
                cot=cot,
            )
            agent_b = CyberWarAgent(
                agent_name="Country_B",
                player_id="B",
                llm=llm,
                risk_orientation=(
                    "risk-averse (defensive)" if concept == "maxmin"
                    else "risk-seeking (aggressive)"
                ),
                choice_prompt_template=prompt_config.agent_choice_prompt,
                free_prompt_template=prompt_config.agent_free_prompt,
                cot=cot,
            )

            controller = CyberWargameController(
                agent_a=agent_a,
                agent_b=agent_b,
                matrices=matrices,
                solution_concept=concept,
                prompt_config=prompt_config,
            )

            result = controller.run_full_game()
            result["run_number"] = run_num
            runs.append(result)

        summary = build_summary(runs, matrices)
        all_results[concept] = {
            "runs": runs,
            "summary": summary,
        }

    return all_results


def _compute_price_of_aggression(all_results: dict) -> dict | None:
    """Compute Price of Aggression if both concepts were run."""
    if "maxmin" not in all_results or "minmax" not in all_results:
        return None

    maxmin_a = np.mean([r["meta_game"]["payoff_a"] for r in all_results["maxmin"]["runs"]])
    maxmin_b = np.mean([r["meta_game"]["payoff_b"] for r in all_results["maxmin"]["runs"]])
    minmax_a = np.mean([r["meta_game"]["payoff_a"] for r in all_results["minmax"]["runs"]])
    minmax_b = np.mean([r["meta_game"]["payoff_b"] for r in all_results["minmax"]["runs"]])

    return {
        "A": round(float(maxmin_a / minmax_a), 4) if minmax_a != 0 else None,
        "B": round(float(maxmin_b / minmax_b), 4) if minmax_b != 0 else None,
    }


def _save_results(all_results: dict, output_dir: Path, config_name: str,
                   backend: str, num_runs: int, cot: bool = False) -> Path:
    """Save results JSON."""
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = "simulation_results_cot.json" if cot else "simulation_results.json"
    output_path = output_dir / filename

    poa = _compute_price_of_aggression(all_results)

    serializable = {
        "prompt_config": config_name,
        "backend": backend,
        "num_runs": num_runs,
        "chain_of_thought": cot,
        "timestamp": datetime.now().isoformat(),
    }

    for concept, data in all_results.items():
        serializable[concept] = {
            "runs": data["runs"],
            "summary": data["summary"],
        }

    if poa is not None:
        serializable["price_of_aggression"] = poa

    with open(output_path, "w") as f:
        json.dump(serializable, f, indent=2, default=str)
    return output_path


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Cyber Warfare Wargame Simulation")
    parser.add_argument(
        "--backend", default="gemini",
        choices=["ollama", "gemini"],
        help="LLM backend to use (default: gemini)"
    )
    parser.add_argument(
        "--runs", type=int, default=NUM_RUNS,
        help=f"Number of simulation runs per config (default: {NUM_RUNS})"
    )
    parser.add_argument(
        "--concept", nargs="+", default=["maxmin", "minmax"],
        choices=["maxmin", "minmax"],
        help="Solution concepts to simulate (default: both)"
    )
    parser.add_argument(
        "--config", nargs="*", default=None,
        help="Specific config names to run (e.g. v1_rational_eut). "
             "Omit to run all configs in prompts/."
    )
    parser.add_argument(
        "--cot", action="store_true",
        help="Enable Chain-of-Thought reasoning."
    )
    args = parser.parse_args()

    all_configs = discover_prompt_configs(PROMPTS_DIR)
    if not all_configs:
        print(f"ERROR: No config_*.py files found in {PROMPTS_DIR}")
        return

    if args.config:
        selected = [cfg for cfg in all_configs if cfg.name in args.config]
        if not selected:
            available = [c.name for c in all_configs]
            print(f"ERROR: None of {args.config} found. Available: {available}")
            return
        all_configs = selected

    print(f"Backend: {args.backend} | Runs: {args.runs} | Concepts: {args.concept}")
    print(f"Configs: {[c.name for c in all_configs]}")

    for cfg in all_configs:
        print(f"\n--- {cfg.name} ---")

        results = run_simulation_for_config(
            prompt_config=cfg,
            backend_name=args.backend,
            num_runs=args.runs,
            solution_concepts=args.concept,
            cot=args.cot,
        )

        output_dir = RESULTS_DIR / cfg.name
        saved = _save_results(results, output_dir, cfg.name,
                              args.backend, args.runs, cot=args.cot)
        print(f"  -> {saved}")

    print("\nDone.")


if __name__ == "__main__":
    main()
