"""
Progress monitor for Concordia simulations.
Run: python watch_progress.py
"""

import re
import sys
import time
from pathlib import Path

LOG_FILE = Path(__file__).parent / "simulation_log.txt"

# All expected symmetric configs
SYMMETRIC_CONFIGS = [
    "v1_rational_eut",
    "v2_bounded_satisficing",
    "v3_bounded_prospect_theory",
    "v4_irrational_hawkish",
    "v5_irrational_retaliatory",
]
# All 20 asymmetric cross-play matchups
CROSSPLAY_PAIRS = [
    (a, b)
    for i, a in enumerate(SYMMETRIC_CONFIGS)
    for b in SYMMETRIC_CONFIGS[i + 1 :]
] + [
    (b, a)
    for i, a in enumerate(SYMMETRIC_CONFIGS)
    for b in SYMMETRIC_CONFIGS[i + 1 :]
]

TOTAL_SYMMETRIC = len(SYMMETRIC_CONFIGS)   # 5
TOTAL_CROSSPLAY  = len(CROSSPLAY_PAIRS)    # 20
TOTAL_RUNS = TOTAL_SYMMETRIC + TOTAL_CROSSPLAY  # 25


def parse_log(text: str) -> dict:
    state = {
        "phase": "batch1_symmetric",
        "symmetric_done": [],
        "symmetric_current": None,
        "symmetric_concept": None,
        "crossplay_done": [],
        "crossplay_current": None,
        "crossplay_concept": None,
        "errors": [],
        "retries": [],
        "crashed": False,
        "finished": False,
        "last_line": "",
    }

    lines = text.strip().splitlines()
    if lines:
        state["last_line"] = lines[-1].strip()

    # Detect crash
    if "Traceback" in text or "Error" in text.split("Traceback")[-1]:
        state["crashed"] = True

    in_crossplay = "cross_play" in text.lower() or "cross-play" in text.lower() or "--cross-play" in text

    # Symmetric: look for "--- v*_* ---" headers
    sym_headers = re.findall(r"--- (v\d+_\w+) ---", text)
    for h in sym_headers:
        if h not in state["symmetric_done"]:
            state["symmetric_done"].append(h)

    # Current symmetric in progress
    concept_match = re.findall(r"(v\d+_\w+) \| (maxmin|minmax) \| run", text)
    if concept_match and not in_crossplay:
        state["symmetric_current"] = concept_match[-1][0]
        state["symmetric_concept"] = concept_match[-1][1]

    # Saved results = actually finished
    saved = re.findall(r"Results saved.*?(v\d+_\w+)", text)
    for s in saved:
        if s not in state["symmetric_done"]:
            state["symmetric_done"].append(s)

    # Cross-play phase detection
    if in_crossplay:
        state["phase"] = "batch2_crossplay"
        cp_current = re.findall(r"Cross-play.*?(v\d+_\w+)\s+vs\s+(v\d+_\w+)", text, re.IGNORECASE)
        if not cp_current:
            cp_current = re.findall(r"(v\d+_\w+)_vs_(v\d+_\w+)", text)
        if cp_current:
            state["crossplay_current"] = cp_current[-1]

        cp_done = re.findall(r"Results saved.*?crossplay.*?(v\d+_\w+).*?(v\d+_\w+)", text, re.IGNORECASE)
        state["crossplay_done"] = list(cp_done)

    # Retries
    state["retries"] = re.findall(r"\[Ollama\].*?retrying.*?\(attempt \d+/\d+\)", text)

    # Finished
    if "All simulations complete" in text or (
        in_crossplay and len(state["crossplay_done"]) >= TOTAL_CROSSPLAY
    ):
        state["finished"] = True

    return state


def bar(done: int, total: int, width: int = 30) -> str:
    filled = int(width * done / total) if total else 0
    pct = int(100 * done / total) if total else 0
    return f"[{'#' * filled}{'.' * (width - filled)}] {done}/{total} ({pct}%)"


def render(state: dict) -> str:
    lines = []
    lines.append("=" * 58)
    lines.append("  CONCORDIA SIMULATION PROGRESS")
    lines.append("=" * 58)

    # Batch 1
    sym_done = len(state["symmetric_done"])
    b1_status = "DONE" if sym_done >= TOTAL_SYMMETRIC else ("RUNNING" if state["phase"] == "batch1_symmetric" else "DONE")
    lines.append(f"\n  BATCH 1 — Symmetric runs  [{b1_status}]")
    lines.append(f"  {bar(min(sym_done, TOTAL_SYMMETRIC), TOTAL_SYMMETRIC)}")
    if state["symmetric_current"] and state["phase"] == "batch1_symmetric":
        lines.append(f"  Current: {state['symmetric_current']} | {state['symmetric_concept']}")
    if state["symmetric_done"]:
        lines.append(f"  Completed: {', '.join(state['symmetric_done'])}")

    # Batch 2
    cp_done = len(state["crossplay_done"])
    b2_status = "NOT STARTED"
    if state["phase"] == "batch2_crossplay":
        b2_status = "RUNNING"
    if cp_done >= TOTAL_CROSSPLAY:
        b2_status = "DONE"
    lines.append(f"\n  BATCH 2 — Cross-play asymmetric  [{b2_status}]")
    lines.append(f"  {bar(cp_done, TOTAL_CROSSPLAY)}")
    if state["crossplay_current"] and state["phase"] == "batch2_crossplay":
        a, b = state["crossplay_current"]
        lines.append(f"  Current: {a} vs {b}")

    # Overall
    overall_done = min(sym_done, TOTAL_SYMMETRIC) + cp_done
    lines.append(f"\n  OVERALL")
    lines.append(f"  {bar(overall_done, TOTAL_RUNS)}")

    # Retries / warnings
    if state["retries"]:
        lines.append(f"\n  Last retry: {state['retries'][-1]}")

    # Status
    lines.append("")
    if state["finished"]:
        lines.append("  STATUS: ALL DONE")
    elif state["crashed"]:
        lines.append("  STATUS: CRASHED — check simulation_log.txt")
    else:
        lines.append(f"  STATUS: Running...  Last: {state['last_line'][:50]}")

    lines.append("=" * 58)
    return "\n".join(lines)


def main():
    if not LOG_FILE.exists():
        print("Waiting for simulation_log.txt to appear...")

    prev_size = -1
    try:
        while True:
            if LOG_FILE.exists():
                text = LOG_FILE.read_text(encoding="utf-8", errors="replace")
                size = len(text)
                if size != prev_size:
                    prev_size = size
                    state = parse_log(text)
                    # Clear screen
                    print("\033[2J\033[H", end="")
                    print(render(state))
                    if state["finished"] or state["crashed"]:
                        break
            time.sleep(3)
    except KeyboardInterrupt:
        print("\nMonitor stopped.")


if __name__ == "__main__":
    main()
