"""Configuration constants and descriptions for the cyber wargame."""

from pathlib import Path

# =============================================================================
# Paths
# =============================================================================

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(__file__).resolve().parent / "constants"
MAXMIN_DIR = DATA_DIR / "Sim 1 - Maxmin"
MINMAX_DIR = DATA_DIR / "Sim1 - Minmax"

# =============================================================================
# Game Parameters
# =============================================================================

MODES = ["P", "S", "C"]  # Private Actor, State Unit, Coalition
ACTIONS = ["R", "Th"]     # Attack, Threaten
MODE_NAMES = {"P": "Private Actor", "S": "State Unit", "C": "Coalition"}
ACTION_NAMES = {"R": "Attack (R)", "Th": "Threaten (Th)"}

NUM_RUNS = 5

# =============================================================================
# Descriptions (used in agent prompts)
# =============================================================================

MODE_DESCRIPTIONS = {
    "P": (
        "Private Actor (P): Lowest cost, highest operational success rate, "
        "lowest escalation risk, lowest attribution likelihood, "
        "but lowest threat credibility."
    ),
    "S": (
        "State Unit (S): Highest cost, lower operational success, "
        "highest escalation risk, highest attribution likelihood, "
        "but highest threat credibility."
    ),
    "C": (
        "Coalition (C): Shared cost (moderate), moderate success rate, "
        "highest escalation risk, moderate attribution, "
        "moderate threat credibility."
    ),
}

ACTION_DESCRIPTIONS = {
    "R": (
        "Attack (R): Execute the cyber operation now. "
        "Payoff = (v-c)(1-β)/(1-α) where v=success, c=cost, "
        "β=attribution risk, α=escalation risk. "
        "Higher immediate impact but carries escalation and attribution risks."
    ),
    "Th": (
        "Threaten (Th): Threaten a future cyber attack without executing. "
        "Payoff = (v-c)γ where γ=threat credibility. "
        "Lower risk but effectiveness depends on credibility."
    ),
}


# =============================================================================
# Prompt Templates
# =============================================================================

GAME_CONTEXT_TEMPLATE = (
    "=== CYBER WARFARE WARGAME ===\n"
    "Solution Concept: {solution_concept} "
    "({concept_description})\n\n"
    "You are playing a two-stage cyber warfare game against another country.\n\n"
    "ATTACK MODES:\n"
    "{mode_descriptions}\n"
    "ACTION TYPES:\n"
    "{action_descriptions}\n"
    "GAME STRUCTURE:\n"
    "  Stage 1: For each of 9 mode combinations (your mode x opponent's mode),\n"
    "           choose Attack (R) or Threaten (Th).\n"
    "  Stage 2: Based on Stage 1 results, choose your overall attack mode (P, S, or C).\n"
    "\nYour goal: Maximize your payoff based on the payoff matrices provided.\n"
)

SUBGAME_OBSERVATION_A = (
    "\n--- SUBGAME ({mode_a} vs {mode_b}) ---\n"
    "You are Country A using {mode_a_name}.\n"
    "Country B is using {mode_b_name}.\n\n"
    "{matrix_info}\n\n"
    "Your payoff matrix (Country A):\n"
    "  If you Attack (R) and B Attacks (R):    {rr:.4f}\n"
    "  If you Attack (R) and B Threatens (Th): {rth:.4f}\n"
    "  If you Threaten (Th) and B Attacks (R): {thr:.4f}\n"
    "  If you Threaten (Th) and B Threatens (Th): {thth:.4f}\n"
)

SUBGAME_OBSERVATION_B = (
    "\n--- SUBGAME ({mode_a} vs {mode_b}) ---\n"
    "Country A is using {mode_a_name}.\n"
    "You are Country B using {mode_b_name}.\n\n"
    "{matrix_info}\n\n"
    "Your payoff matrix (Country B):\n"
    "  If A Attacks (R) and you Attack (R):    {rr:.4f}\n"
    "  If A Attacks (R) and you Threaten (Th): {rth:.4f}\n"
    "  If A Threatens (Th) and you Attack (R): {thr:.4f}\n"
    "  If A Threatens (Th) and you Threaten (Th): {thth:.4f}\n"
)

SUBGAME_CALL_TO_ACTION = (
    "In subgame ({mode_a} vs {mode_b}), choose your action. "
    "Pick the action that gives you the best payoff considering "
    "what your opponent might do."
)

SUBGAME_OUTCOME = (
    "Result of subgame ({mode_a} vs {mode_b}): "
    "Country A chose {action_a}, "
    "Country B chose {action_b}. "
)

META_GAME_HEADER = (
    "\n=== META-GAME (Stage 2) ===\n"
    "Based on the subgame results, here is the 3x3 meta-game matrix.\n"
    "Choose your overall attack mode (P, S, or C).\n\n"
    "Your payoffs ({player_label}) based on mode choices:\n"
)

META_GAME_CALL_TO_ACTION = (
    "Choose your overall attack mode for the meta-game. "
    "Consider which mode gives you the best payoff across all "
    "possible opponent mode choices."
)

AGENT_CHOICE_PROMPT = (
    "You are {agent_name}, representing Country {player_id} "
    "in a cyber warfare strategic game.\n"
    "Your risk orientation: {risk_orientation}\n\n"
    "Current situation:\n{context}\n\n"
    "{call_to_action}\n\n"
    "Available options: {options}\n"
    "Choose the option that maximizes your payoff given the matrix above."
)

AGENT_FREE_PROMPT = (
    "You are {agent_name}, representing Country {player_id} "
    "in a cyber warfare strategic game.\n"
    "Your risk orientation: {risk_orientation}\n\n"
    "Current situation:\n{context}\n\n"
    "{call_to_action}"
)
