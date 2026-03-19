#!/usr/bin/env python3
"""CLI entrypoint for the Cyber Warfare Wargame Simulation.

Discovers all prompt configs in prompts/ and runs the full simulation
(maxmin + minmax) for each one, saving results to results/<config_name>/.
"""

import json
import logging
from datetime import datetime
from pathlib import Path

import numpy as np

from src.agent import CyberWarAgent
from src.analysis import analyze_results
from src.backends import get_llm_backend
from src.constants import BASE_DIR, MAXMIN_DIR, MINMAX_DIR, MODE_NAMES, NUM_RUNS
from src.controller import CyberWargameController
from src.data_loader import load_payoff_matrices
from src.prompt_config import PromptConfig, discover_prompt_configs


PROMPTS_DIR = BASE_DIR / "src" / "prompts"
RESULTS_DIR = BASE_DIR / "results"
LOG_DIR = BASE_DIR / "logs"


def _setup_logger() -> logging.Logger:
    """Set up a file logger that appends to a timestamped log file."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_file = LOG_DIR / f"simulation_{datetime.now():%Y%m%d_%H%M%S}.log"

    logger = logging.getLogger("simulation")
    logger.setLevel(logging.INFO)

    handler = logging.FileHandler(log_file)
    handler.setFormatter(logging.Formatter("%(asctime)s  %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
    logger.addHandler(handler)

    print(f"  Log file: {log_file}")
    return logger


def _log_run_result(
    logger: logging.Logger,
    config_name: str,
    concept: str,
    result: dict,
):
    """Log a single run's results immediately after it completes."""
    mg = result["meta_game"]
    logger.info(
        "  [%s | %s] Run %d: Mode A=%s, Mode B=%s | "
        "Payoff A=%.4f, B=%.4f | %s",
        config_name, concept.upper(), result["run_number"],
        MODE_NAMES[mg["mode_a"]], MODE_NAMES[mg["mode_b"]],
        mg["payoff_a"], mg["payoff_b"],
        result["world_state"],
    )
    # Log subgame choices
    for key, sg in result["subgames"].items():
        logger.info(
            "    Subgame %s: A=%s, B=%s | Payoff A=%.4f, B=%.4f",
            key, sg["action_a"], sg["action_b"],
            sg["payoff_a"], sg["payoff_b"],
        )


def _log_config_summary(
    logger: logging.Logger,
    config_name: str,
    all_results: dict,
):
    """Log aggregate summary after all runs for a config are done."""
    logger.info("")
    logger.info("=" * 70)
    logger.info("SUMMARY: %s", config_name)
    logger.info("=" * 70)

    for concept, data in all_results.items():
        runs = data["runs"]
        logger.info("")
        logger.info("  Solution Concept: %s  (%d runs)", concept.upper(), len(runs))
        logger.info("  " + "-" * 50)

        # Aggregate stats
        a_payoffs = [r["meta_game"]["payoff_a"] for r in runs]
        b_payoffs = [r["meta_game"]["payoff_b"] for r in runs]
        logger.info(
            "  Payoff A: mean=%.4f std=%.4f  |  Payoff B: mean=%.4f std=%.4f",
            np.mean(a_payoffs), np.std(a_payoffs),
            np.mean(b_payoffs), np.std(b_payoffs),
        )

        # Mode choice distribution
        a_modes = [r["meta_game"]["mode_a"] for r in runs]
        b_modes = [r["meta_game"]["mode_b"] for r in runs]
        for mode in ["P", "S", "C"]:
            logger.info(
                "  Mode %s (%s): A=%d/%d, B=%d/%d",
                mode, MODE_NAMES[mode],
                a_modes.count(mode), len(a_modes),
                b_modes.count(mode), len(b_modes),
            )

        # World state distribution
        ws_counts: dict[str, int] = {}
        for r in runs:
            ws = r["world_state"]
            ws_counts[ws] = ws_counts.get(ws, 0) + 1
        for ws, count in ws_counts.items():
            logger.info("  World State: %s  %d/%d", ws, count, len(runs))

    # Price of Aggression
    if "maxmin" in all_results and "minmax" in all_results:
        maxmin_a = np.mean([r["meta_game"]["payoff_a"] for r in all_results["maxmin"]["runs"]])
        minmax_a = np.mean([r["meta_game"]["payoff_a"] for r in all_results["minmax"]["runs"]])
        maxmin_b = np.mean([r["meta_game"]["payoff_b"] for r in all_results["maxmin"]["runs"]])
        minmax_b = np.mean([r["meta_game"]["payoff_b"] for r in all_results["minmax"]["runs"]])
        logger.info("")
        if minmax_a != 0:
            logger.info("  Price of Aggression A: Λ = %.4f / %.4f = %.4f", maxmin_a, minmax_a, maxmin_a / minmax_a)
        if minmax_b != 0:
            logger.info("  Price of Aggression B: Λ = %.4f / %.4f = %.4f", maxmin_b, minmax_b, maxmin_b / minmax_b)

    logger.info("")


def run_simulation_for_config(
    prompt_config: PromptConfig,
    backend_name: str = "gemini",
    num_runs: int = NUM_RUNS,
    solution_concepts: list[str] | None = None,
    logger: logging.Logger | None = None,
    cot: bool = False,
) -> dict:
    """Run the full simulation for a single prompt config.

    Returns the aggregated results dict.
    """
    if solution_concepts is None:
        solution_concepts = ["maxmin", "minmax"]

    llm = get_llm_backend(backend_name)
    all_results = {}

    for concept in solution_concepts:
        print(f"\n{'#'*70}")
        print(f"  SIMULATION: {concept.upper()} Solution Concept")
        print(f"{'#'*70}")

        if concept == "maxmin":
            matrices = load_payoff_matrices(MAXMIN_DIR)
        elif concept == "minmax":
            matrices = load_payoff_matrices(MINMAX_DIR, suffix="_d")
        else:
            raise ValueError(f"Unknown solution concept: {concept}")

        runs = []
        for run_num in range(1, num_runs + 1):
            print(f"\n{'='*50}")
            print(f"  Run {run_num}/{num_runs} - {concept.upper()}")
            print(f"{'='*50}")

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

            if logger:
                _log_run_result(logger, prompt_config.name, concept, result)

        analysis = analyze_results(runs, matrices, concept)
        print(analysis)

        all_results[concept] = {
            "runs": runs,
            "analysis": analysis,
        }

    return all_results


def _price_of_aggression(all_results: dict) -> str:
    """Compute and format the Price of Aggression comparison."""
    if "maxmin" not in all_results or "minmax" not in all_results:
        return ""

    lines = [
        f"\n{'='*70}",
        "  PRICE OF AGGRESSION ANALYSIS",
        f"{'='*70}",
    ]

    maxmin_a = np.mean([r["meta_game"]["payoff_a"] for r in all_results["maxmin"]["runs"]])
    maxmin_b = np.mean([r["meta_game"]["payoff_b"] for r in all_results["maxmin"]["runs"]])
    minmax_a = np.mean([r["meta_game"]["payoff_a"] for r in all_results["minmax"]["runs"]])
    minmax_b = np.mean([r["meta_game"]["payoff_b"] for r in all_results["minmax"]["runs"]])

    if minmax_a != 0:
        poa_a = maxmin_a / minmax_a
        lines.append(f"  Country A: Λ_A = π_De / π_Ag = {maxmin_a:.4f} / {minmax_a:.4f} = {poa_a:.4f}")
    else:
        lines.append("  Country A: Λ_A undefined (aggressive payoff = 0)")

    if minmax_b != 0:
        poa_b = maxmin_b / minmax_b
        lines.append(f"  Country B: Λ_B = π_De / π_Ag = {maxmin_b:.4f} / {minmax_b:.4f} = {poa_b:.4f}")
    else:
        lines.append("  Country B: Λ_B undefined (aggressive payoff = 0)")

    lines.extend([
        "",
        "  Interpretation:",
        "    Λ > 1: Defensive stance is preferable (aggression is costly)",
        "    Λ < 1: Aggressive stance yields better payoffs",
        "    Λ = 1: No difference between stances",
    ])
    return "\n".join(lines)


def _save_results(all_results: dict, output_dir: Path, config_name: str, cot: bool = False):
    """Save results JSON and return the path."""
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = "simulation_results_cot.json" if cot else "simulation_results.json"
    output_path = output_dir / filename

    serializable = {
        "prompt_config": config_name,
        "chain_of_thought": cot,
        **{
            concept: {
                "runs": data["runs"],
                "analysis": data["analysis"],
            }
            for concept, data in all_results.items()
        },
    }
    with open(output_path, "w") as f:
        json.dump(serializable, f, indent=2, default=str)
    print(f"\n  Results saved to: {output_path}")
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
        help="Enable Chain-of-Thought reasoning. Agents reason step-by-step "
             "before choosing. Results saved to simulation_results_cot.json."
    )
    args = parser.parse_args()

    # Discover configs
    all_configs = discover_prompt_configs(PROMPTS_DIR)
    if not all_configs:
        print(f"ERROR: No config_*.py files found in {PROMPTS_DIR}")
        return

    # Filter if specific configs requested
    if args.config:
        selected = []
        for cfg in all_configs:
            if cfg.name in args.config:
                selected.append(cfg)
        if not selected:
            available = [c.name for c in all_configs]
            print(f"ERROR: None of {args.config} found. Available: {available}")
            return
        all_configs = selected

    logger = _setup_logger()

    cot_label = " | CoT: ON" if args.cot else ""
    print("=" * 70)
    print("  CYBER WARFARE WARGAME SIMULATION")
    print(f"  Backend: {args.backend} | Runs: {args.runs} | Concepts: {args.concept}{cot_label}")
    print(f"  Configs to run: {[c.name for c in all_configs]}")
    print("=" * 70)

    logger.info("SIMULATION START  |  Backend: %s  |  Runs: %d  |  Concepts: %s  |  CoT: %s",
                args.backend, args.runs, args.concept, args.cot)
    logger.info("Configs: %s", [c.name for c in all_configs])

    summary_paths = []
    for cfg in all_configs:
        print(f"\n{'*'*70}")
        print(f"  CONFIG: {cfg.name}")
        print(f"{'*'*70}")

        results = run_simulation_for_config(
            prompt_config=cfg,
            backend_name=args.backend,
            num_runs=args.runs,
            solution_concepts=args.concept,
            logger=logger,
            cot=args.cot,
        )

        _log_config_summary(logger, cfg.name, results)

        poa_text = _price_of_aggression(results)
        if poa_text:
            print(poa_text)

        output_dir = RESULTS_DIR / cfg.name
        saved = _save_results(results, output_dir, cfg.name, cot=args.cot)
        summary_paths.append((cfg.name, saved))

    # Final summary
    print(f"\n{'='*70}")
    print("  ALL SIMULATIONS COMPLETE")
    print(f"{'='*70}")
    for name, path in summary_paths:
        print(f"  {name}: {path}")

    logger.info("ALL SIMULATIONS COMPLETE")
    for name, path in summary_paths:
        logger.info("  %s: %s", name, path)


if __name__ == "__main__":
    main()
