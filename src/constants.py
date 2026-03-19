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
# Prompt Templates (used by controller and agent)
#
# These are the exact text prompts that get sent to the LLM agents during the
# simulation. They use Python's str.format() placeholders (e.g. {mode_a})
# which get filled in at runtime by controller.py and agent.py.
#
# All prompt text is centralized here so you can tweak the wording in one
# place without digging through game logic code.
# =============================================================================

# ---------------------------------------------------------------------------
# GAME CONTEXT TEMPLATE
# ---------------------------------------------------------------------------
# When:    Sent ONCE at the very start of a game run, before any subgames.
# Who:     Both agents (Country A and Country B) receive the same text.
# Purpose: Gives the agent its "briefing" — explains the overall game rules,
#          what modes and actions exist, and what the two stages are.
#          This becomes the first entry in each agent's observation memory.
# Called from: controller.py → _send_game_context()
#
# Placeholders:
#   {solution_concept}    – "MAXMIN" or "MINMAX"
#   {concept_description} – "Defensive/Worst-case" or "Aggressive/Best-case"
#   {mode_descriptions}   – Formatted list of P/S/C mode descriptions
#   {action_descriptions} – Formatted list of R/Th action descriptions
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# SUBGAME OBSERVATIONS (A and B variants)
# ---------------------------------------------------------------------------
# When:    Sent before EACH of the 9 subgames (called 9 times per run).
# Who:     Each agent gets their own version — A sees "You are Country A",
#          B sees "You are Country B" — with their own payoff numbers.
# Purpose: Shows the agent the specific mode matchup and their 2×2 payoff
#          matrix so they can reason about whether to Attack or Threaten.
#          This is the key information the LLM uses to make its decision.
# Called from: controller.py → play_subgame()
#
# Placeholders:
#   {mode_a}, {mode_b}   – Mode codes like "P", "S", "C"
#   {mode_a_name}        – Full name like "Private Actor"
#   {mode_b_name}        – Full name like "Coalition"
#   {matrix_info}        – Pretty-printed payoff matrices for both players
#   {rr}                 – Payoff when you Attack & opponent Attacks
#   {rth}                – Payoff when you Attack & opponent Threatens
#   {thr}                – Payoff when you Threaten & opponent Attacks
#   {thth}               – Payoff when you Threaten & opponent Threatens
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# SUBGAME CALL-TO-ACTION
# ---------------------------------------------------------------------------
# When:    Sent immediately after the subgame observation above.
# Who:     Both agents get the same text (only {mode_a}/{mode_b} differ).
# Purpose: This is the actual "question" that triggers the agent to decide.
#          It's wrapped into a Concordia ActionSpec with output_type=CHOICE,
#          meaning the agent MUST pick from ["R", "Th"] — not free-form text.
# Called from: controller.py → play_subgame() → passed to agent.act()
#
# Placeholders:
#   {mode_a}, {mode_b} – Mode codes for this subgame
# ---------------------------------------------------------------------------
SUBGAME_CALL_TO_ACTION = (
    "In subgame ({mode_a} vs {mode_b}), choose your action. "
    "Pick the action that gives you the best payoff considering "
    "what your opponent might do."
)

# ---------------------------------------------------------------------------
# SUBGAME OUTCOME
# ---------------------------------------------------------------------------
# When:    Sent AFTER each subgame is resolved (both agents have chosen).
# Who:     Both agents, each with their own payoff appended separately.
# Purpose: Tells the agent what happened — what both players chose and
#          what payoff they received. This goes into the agent's memory
#          so it can learn from past subgames when making future decisions.
# Called from: controller.py → play_subgame() (after payoffs are computed)
#
# Placeholders:
#   {mode_a}, {mode_b} – Mode codes for this subgame
#   {action_a}         – What Country A chose, e.g. "Attack (R)"
#   {action_b}         – What Country B chose, e.g. "Threaten (Th)"
# ---------------------------------------------------------------------------
SUBGAME_OUTCOME = (
    "Result of subgame ({mode_a} vs {mode_b}): "
    "Country A chose {action_a}, "
    "Country B chose {action_b}. "
)

# ---------------------------------------------------------------------------
# META-GAME HEADER
# ---------------------------------------------------------------------------
# When:    Sent ONCE after all 9 subgames are done (start of Stage 2).
# Who:     Both agents, but with different {player_label} ("Country A"/"B").
# Purpose: Introduces the final 3×3 meta-game. The controller appends the
#          actual payoff grid below this header before sending it. This is
#          where the agent sees the big picture — all 9 subgame outcomes
#          laid out in a matrix — and prepares to choose P, S, or C.
# Called from: controller.py → play_meta_game()
#
# Placeholders:
#   {player_label} – "Country A" or "Country B"
# ---------------------------------------------------------------------------
META_GAME_HEADER = (
    "\n=== META-GAME (Stage 2) ===\n"
    "Based on the subgame results, here is the 3x3 meta-game matrix.\n"
    "Choose your overall attack mode (P, S, or C).\n\n"
    "Your payoffs ({player_label}) based on mode choices:\n"
)

# ---------------------------------------------------------------------------
# META-GAME CALL-TO-ACTION
# ---------------------------------------------------------------------------
# When:    Sent right after the meta-game header + payoff grid.
# Who:     Both agents (same text).
# Purpose: The final "question" — asks the agent to pick their overall mode.
#          Wrapped in a Concordia ActionSpec with options=("P", "S", "C").
#          The agent's choice here determines the final game outcome.
# Called from: controller.py → play_meta_game() → passed to agent.act()
#
# No placeholders — this is static text.
# ---------------------------------------------------------------------------
META_GAME_CALL_TO_ACTION = (
    "Choose your overall attack mode for the meta-game. "
    "Consider which mode gives you the best payoff across all "
    "possible opponent mode choices."
)

# ---------------------------------------------------------------------------
# AGENT PROMPT TEMPLATES
# ---------------------------------------------------------------------------
# When:    Every time agent.act() is called (once per subgame + once for
#          the meta-game = 10 times per run).
# Who:     The individual agent that is being asked to act.
# Purpose: This is the FINAL prompt that actually gets sent to the LLM
#          (Gemini, Ollama, or mock). It wraps together:
#          1. The agent's identity and risk orientation
#          2. The last 10 observations (accumulated context/memory)
#          3. The call-to-action and available options
#          The LLM reads this and returns its choice.
# Called from: agent.py → _build_choice_prompt() / _build_free_prompt()
#
# AGENT_CHOICE_PROMPT — used when the agent must pick from a list (CHOICE).
# AGENT_FREE_PROMPT   — used for free-form text responses (currently unused
#                        in the game but available for future extensions).
#
# Placeholders:
#   {agent_name}       – e.g. "Country_A"
#   {player_id}        – "A" or "B"
#   {risk_orientation} – e.g. "risk-averse (defensive)"
#   {context}          – Last 10 observations joined as text
#   {call_to_action}   – The specific question being asked
#   {options}          – List of valid choices, e.g. ['R', 'Th']
# ---------------------------------------------------------------------------
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
