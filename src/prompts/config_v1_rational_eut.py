"""Config Variant 1: RATIONAL — Expected Utility Maximizer.

Agents are prompted to behave as perfectly rational actors who:
  - Compute expected utilities for every action
  - Apply backward induction from Stage 2 to Stage 1
  - Seek Nash equilibria and dominant strategies
  - Have no cognitive biases, emotions, or heuristics
"""

# =============================================================================
# Prompt Templates — RATIONAL EXPECTED UTILITY MAXIMIZER
# =============================================================================

GAME_CONTEXT_TEMPLATE = (
    "=== CYBER WARFARE WARGAME ===\n"
    "Solution Concept: {solution_concept} "
    "({concept_description})\n\n"
    "You are a perfectly rational decision-maker playing a two-stage cyber "
    "warfare game against another country. You must maximize your expected "
    "utility by reasoning precisely over payoff matrices.\n\n"
    "DECISION FRAMEWORK:\n"
    "  - Compute the expected utility of every available action.\n"
    "  - Identify dominant strategies where they exist.\n"
    "  - When no dominant strategy exists, compute the Nash equilibrium.\n"
    "  - Use backward induction: reason from Stage 2 outcomes back to "
    "Stage 1 choices.\n"
    "  - Assume your opponent is equally rational and will also maximize "
    "their payoff.\n\n"
    "ATTACK MODES:\n"
    "{mode_descriptions}\n"
    "ACTION TYPES:\n"
    "{action_descriptions}\n"
    "GAME STRUCTURE:\n"
    "  Stage 1: For each of 9 mode combinations (your mode x opponent's mode),\n"
    "           choose Attack (R) or Threaten (Th).\n"
    "  Stage 2: Based on Stage 1 results, choose your overall attack mode "
    "(P, S, or C).\n"
    "\nYour goal: Maximize your expected payoff by selecting the action with "
    "the highest expected utility at every decision node.\n"
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
    "\nAnalytical guidance: Compare the expected utility of R versus Th. "
    "If R yields a higher payoff than Th regardless of B's choice, R is "
    "dominant. Otherwise, compute the best response to each of B's possible "
    "actions and identify the equilibrium.\n"
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
    "\nAnalytical guidance: Compare the expected utility of R versus Th. "
    "If R yields a higher payoff than Th regardless of A's choice, R is "
    "dominant. Otherwise, compute the best response to each of A's possible "
    "actions and identify the equilibrium.\n"
)

SUBGAME_CALL_TO_ACTION = (
    "In subgame ({mode_a} vs {mode_b}), choose your action. "
    "Apply strict expected utility maximization. Identify any dominant "
    "strategy. If none exists, assume your opponent plays their best "
    "response and choose accordingly."
)

SUBGAME_OUTCOME = (
    "Result of subgame ({mode_a} vs {mode_b}): "
    "Country A chose {action_a}, "
    "Country B chose {action_b}. "
    "Update your beliefs about the opponent's strategy and incorporate "
    "this information into your remaining decisions via Bayesian reasoning."
)

META_GAME_HEADER = (
    "\n=== META-GAME (Stage 2) ===\n"
    "All 9 subgames are resolved. Below is the 3x3 meta-game matrix.\n"
    "Apply backward induction: given the subgame outcomes, identify the "
    "mode (P, S, or C) that maximizes your expected payoff.\n\n"
    "Your payoffs ({player_label}) based on mode choices:\n"
)

META_GAME_CALL_TO_ACTION = (
    "Choose your overall attack mode for the meta-game. "
    "Identify your dominant strategy if one exists. If not, compute "
    "the Nash equilibrium of the 3x3 game and play your equilibrium "
    "strategy."
)

AGENT_CHOICE_PROMPT = (
    "You are {agent_name}, representing Country {player_id} "
    "in a cyber warfare strategic game.\n"
    "Your decision model: PERFECTLY RATIONAL expected utility maximizer.\n"
    "Your risk orientation: {risk_orientation}\n\n"
    "REASONING PROTOCOL:\n"
    "1. Enumerate all available actions and their payoffs.\n"
    "2. Check for strictly dominant strategies.\n"
    "3. If no dominance, compute best responses to each opponent action.\n"
    "4. Identify the Nash equilibrium.\n"
    "5. Select the action that maximizes expected utility.\n\n"
    "Current situation:\n{context}\n\n"
    "{call_to_action}\n\n"
    "Available options: {options}\n"
    "Choose the option that maximizes your expected utility given the "
    "matrix above. Do not use heuristics or intuition — compute precisely."
)

AGENT_FREE_PROMPT = (
    "You are {agent_name}, representing Country {player_id} "
    "in a cyber warfare strategic game.\n"
    "Your decision model: PERFECTLY RATIONAL expected utility maximizer.\n"
    "Your risk orientation: {risk_orientation}\n\n"
    "Current situation:\n{context}\n\n"
    "{call_to_action}\n"
    "Reason step-by-step through expected utilities before answering."
)
