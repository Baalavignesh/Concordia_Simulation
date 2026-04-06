#!/usr/bin/env python3
"""CLI entrypoint for the Cyber Warfare Wargame Simulation."""

import json
from datetime import datetime
from itertools import product
from pathlib import Path

import numpy as np

from src.agent import CyberWarAgent
from src.analysis import analyze_cot_complexity, build_summary
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
        concept_data = {
            "runs": runs,
            "summary": summary,
        }

        if cot:
            cot_analysis = analyze_cot_complexity(runs)
            if cot_analysis:
                concept_data["cot_complexity"] = cot_analysis

        all_results[concept] = concept_data

    return all_results


def run_crossplay_simulation(
    config_a: PromptConfig,
    config_b: PromptConfig,
    backend_name: str = "gemini",
    num_runs: int = NUM_RUNS,
    solution_concepts: list[str] | None = None,
    cot: bool = False,
) -> dict:
    """Run the simulation with asymmetric configs (different persona per agent)."""
    if solution_concepts is None:
        solution_concepts = ["maxmin", "minmax"]

    matchup_label = f"{config_a.name} vs {config_b.name}"
    llm = get_llm_backend(backend_name)
    all_results = {}

    for concept in solution_concepts:
        if concept == "maxmin":
            matrices = load_payoff_matrices(MAXMIN_DIR)
        elif concept == "minmax":
            matrices = load_payoff_matrices(MINMAX_DIR, suffix="_d")
        else:
            raise ValueError(f"Unknown solution concept: {concept}")

        risk = (
            "risk-averse (defensive)" if concept == "maxmin"
            else "risk-seeking (aggressive)"
        )

        runs = []
        for run_num in range(1, num_runs + 1):
            print(f"  {matchup_label} | {concept} | run {run_num}/{num_runs}", flush=True)

            agent_a = CyberWarAgent(
                agent_name="Country_A",
                player_id="A",
                llm=llm,
                risk_orientation=risk,
                choice_prompt_template=config_a.agent_choice_prompt,
                free_prompt_template=config_a.agent_free_prompt,
                cot=cot,
            )
            agent_b = CyberWarAgent(
                agent_name="Country_B",
                player_id="B",
                llm=llm,
                risk_orientation=risk,
                choice_prompt_template=config_b.agent_choice_prompt,
                free_prompt_template=config_b.agent_free_prompt,
                cot=cot,
            )

            controller = CyberWargameController(
                agent_a=agent_a,
                agent_b=agent_b,
                matrices=matrices,
                solution_concept=concept,
                prompt_config=config_a,
                prompt_config_b=config_b,
            )

            result = controller.run_full_game()
            result["run_number"] = run_num
            runs.append(result)

        summary = build_summary(runs, matrices)
        concept_data = {
            "runs": runs,
            "summary": summary,
        }

        if cot:
            cot_analysis = analyze_cot_complexity(runs)
            if cot_analysis:
                concept_data["cot_complexity"] = cot_analysis

        all_results[concept] = concept_data

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
                   backend: str, num_runs: int, cot: bool = False,
                   config_name_b: str | None = None) -> Path:
    """Save results JSON.

    For cross-play (asymmetric) runs, pass ``config_name_b`` to record
    both agent configs in the output.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = "simulation_results_cot.json" if cot else "simulation_results.json"
    output_path = output_dir / filename

    poa = _compute_price_of_aggression(all_results)

    if config_name_b is not None:
        serializable = {
            "cross_play": True,
            "prompt_config_a": config_name,
            "prompt_config_b": config_name_b,
            "backend": backend,
            "num_runs": num_runs,
            "chain_of_thought": cot,
            "timestamp": datetime.now().isoformat(),
        }
    else:
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


def _find_config_by_name(all_configs: list[PromptConfig], name: str) -> PromptConfig | None:
    """Look up a PromptConfig by name, returning None if not found."""
    for cfg in all_configs:
        if cfg.name == name:
            return cfg
    return None


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Cyber Warfare Wargame Simulation")
    parser.add_argument(
        "--backend", default="ollama",
        choices=["ollama", "gemini"],
        help="LLM backend to use (default: ollama)"
    )
    parser.add_argument(
        "--runs", type=int, default=1,
        help="Number of simulation runs per config (default: 1)"
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

    # Cross-play arguments
    cross_group = parser.add_argument_group("cross-play (asymmetric matchups)")
    cross_group.add_argument(
        "--config-a", default=None,
        help="Config for Country A (requires --config-b)"
    )
    cross_group.add_argument(
        "--config-b", default=None,
        help="Config for Country B (requires --config-a)"
    )
    cross_group.add_argument(
        "--cross-play", action="store_true",
        help="Run all NxN config matchups (including mirror matchups as controls)"
    )
    cross_group.add_argument(
        "--cross-play-asymmetric", action="store_true",
        help="Run only asymmetric matchups (skip mirror pairs where A==B)"
    )

    args = parser.parse_args()

    # Validation
    if (args.config_a is None) != (args.config_b is None):
        parser.error("--config-a and --config-b must be specified together")

    is_crossplay = args.cross_play or args.cross_play_asymmetric or args.config_a
    if is_crossplay and args.config:
        parser.error("--config cannot be combined with cross-play flags")

    all_configs = discover_prompt_configs(PROMPTS_DIR)
    if not all_configs:
        print(f"ERROR: No config_*.py files found in {PROMPTS_DIR}")
        return

    print(f"Backend: {args.backend} | Runs: {args.runs} | Concepts: {args.concept}")

    # --- Cross-play modes ---
    if args.config_a and args.config_b:
        # Single asymmetric pair
        ca = _find_config_by_name(all_configs, args.config_a)
        cb = _find_config_by_name(all_configs, args.config_b)
        if ca is None or cb is None:
            available = [c.name for c in all_configs]
            missing = [n for n, c in [(args.config_a, ca), (args.config_b, cb)] if c is None]
            print(f"ERROR: Config(s) not found: {missing}. Available: {available}")
            return

        matchup_name = f"{ca.name}_vs_{cb.name}"
        print(f"Cross-play: {matchup_name}")
        print(f"\n--- {matchup_name} ---")

        results = run_crossplay_simulation(
            config_a=ca, config_b=cb,
            backend_name=args.backend, num_runs=args.runs,
            solution_concepts=args.concept, cot=args.cot,
        )
        output_dir = RESULTS_DIR / "crossplay" / matchup_name
        saved = _save_results(results, output_dir, ca.name,
                              args.backend, args.runs, cot=args.cot,
                              config_name_b=cb.name)
        print(f"  -> {saved}")

    elif args.cross_play or args.cross_play_asymmetric:
        # All permutations
        pairs = list(product(all_configs, repeat=2))
        if args.cross_play_asymmetric:
            pairs = [(a, b) for a, b in pairs if a.name != b.name]

        print(f"Cross-play: {len(pairs)} matchups")
        for idx, (ca, cb) in enumerate(pairs, 1):
            matchup_name = f"{ca.name}_vs_{cb.name}"
            print(f"\n--- [{idx}/{len(pairs)}] {matchup_name} ---")

            results = run_crossplay_simulation(
                config_a=ca, config_b=cb,
                backend_name=args.backend, num_runs=args.runs,
                solution_concepts=args.concept, cot=args.cot,
            )
            output_dir = RESULTS_DIR / "crossplay" / matchup_name
            saved = _save_results(results, output_dir, ca.name,
                                  args.backend, args.runs, cot=args.cot,
                                  config_name_b=cb.name)
            print(f"  -> {saved}")

    # --- Original symmetric mode ---
    else:
        if args.config:
            selected = [cfg for cfg in all_configs if cfg.name in args.config]
            if not selected:
                available = [c.name for c in all_configs]
                print(f"ERROR: None of {args.config} found. Available: {available}")
                return
            all_configs = selected

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
