"""Data loading and formatting for payoff matrices."""

import csv
from pathlib import Path

import numpy as np

from src.constants import MODES, MODE_NAMES


def load_payoff_matrices(directory: Path, suffix: str = "") -> dict:
    """Load all payoff matrices from CSV files in a directory.

    Returns:
        Dict mapping (player, mode_a, mode_b) -> 2x2 numpy array
        where rows = [R, Th] and columns = [opponent_R, opponent_Th]
    """
    matrices = {}
    for player in ["A", "B"]:
        for mode_a in MODES:
            for mode_b in MODES:
                filename = f"matrix_for_{player}_{mode_a}{mode_b}{suffix}.csv"
                filepath = directory / filename
                if not filepath.exists():
                    print(f"Warning: {filepath} not found, skipping.")
                    continue

                with open(filepath, "r") as f:
                    reader = csv.reader(f)
                    header = next(reader)  # Skip header ("", "V1", "V2")
                    rows = []
                    for row in reader:
                        # row[0] is row index, row[1]=V1, row[2]=V2
                        rows.append([float(row[1]), float(row[2])])
                    matrices[(player, mode_a, mode_b)] = np.array(rows)
    return matrices


def format_payoff_matrix(matrices: dict, mode_a: str, mode_b: str) -> str:
    """Format a subgame's payoff matrices as a readable string."""
    mat_a = matrices.get(("A", mode_a, mode_b))
    mat_b = matrices.get(("B", mode_a, mode_b))

    if mat_a is None or mat_b is None:
        return f"No data for mode combination ({mode_a}, {mode_b})"

    lines = [
        f"Subgame: Country A uses {MODE_NAMES[mode_a]}, "
        f"Country B uses {MODE_NAMES[mode_b]}",
        f"  Mode combination: ({mode_a}, {mode_b})",
        "",
        "  Payoff Matrix for Country A:",
        f"                    B plays R      B plays Th",
        f"    A plays R:      {mat_a[0,0]:>10.4f}    {mat_a[0,1]:>10.4f}",
        f"    A plays Th:     {mat_a[1,0]:>10.4f}    {mat_a[1,1]:>10.4f}",
        "",
        "  Payoff Matrix for Country B:",
        f"                    B plays R      B plays Th",
        f"    A plays R:      {mat_b[0,0]:>10.4f}    {mat_b[0,1]:>10.4f}",
        f"    A plays Th:     {mat_b[1,0]:>10.4f}    {mat_b[1,1]:>10.4f}",
    ]
    return "\n".join(lines)
