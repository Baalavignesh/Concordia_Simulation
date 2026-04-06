"""Deterministic game controller for the two-stage cyber wargame."""

from __future__ import annotations

import numpy as np

from concordia.typing import entity as entity_lib

from src.agent import CyberWarAgent
from src.constants import (
    ACTIONS,
    ACTION_DESCRIPTIONS,
    ACTION_NAMES,
    GAME_CONTEXT_TEMPLATE,
    META_GAME_CALL_TO_ACTION,
    META_GAME_HEADER,
    MODE_DESCRIPTIONS,
    MODE_NAMES,
    MODES,
    SUBGAME_CALL_TO_ACTION,
    SUBGAME_OBSERVATION_A,
    SUBGAME_OBSERVATION_B,
    SUBGAME_OUTCOME,
)
from src.data_loader import format_payoff_matrix
from src.prompt_config import PromptConfig


class CyberWargameController:
    """Controls the two-stage cyber wargame.

    Stage 1: Plays 9 subgames (one per mode combination).
    Stage 2: Builds meta-game and asks agents to choose overall mode.

    Supports asymmetric configs via ``prompt_config_b``: agent A uses
    ``prompt_config`` templates while agent B uses ``prompt_config_b``.
    If only ``prompt_config`` is given, both agents share it (original behavior).
    """

    def __init__(
        self,
        agent_a: CyberWarAgent,
        agent_b: CyberWarAgent,
        matrices: dict,
        solution_concept: str = "maxmin",
        prompt_config: PromptConfig | None = None,
        prompt_config_b: PromptConfig | None = None,
    ):
        self.agent_a = agent_a
        self.agent_b = agent_b
        self.matrices = matrices
        self.solution_concept = solution_concept
        self.subgame_results: dict = {}
        self.meta_game_result: dict = {}

        cfg_a = prompt_config
        cfg_b = prompt_config_b if prompt_config_b is not None else prompt_config

        # Per-agent prompt templates — fall back to defaults from constants
        if cfg_a is not None:
            self._game_context_tpl_a = cfg_a.game_context_template
            self._sub_obs_a = cfg_a.subgame_observation_a
            self._sub_cta_a = cfg_a.subgame_call_to_action
            self._sub_outcome_a = cfg_a.subgame_outcome
            self._meta_header_a = cfg_a.meta_game_header
            self._meta_cta_a = cfg_a.meta_game_call_to_action
        else:
            self._game_context_tpl_a = GAME_CONTEXT_TEMPLATE
            self._sub_obs_a = SUBGAME_OBSERVATION_A
            self._sub_cta_a = SUBGAME_CALL_TO_ACTION
            self._sub_outcome_a = SUBGAME_OUTCOME
            self._meta_header_a = META_GAME_HEADER
            self._meta_cta_a = META_GAME_CALL_TO_ACTION

        if cfg_b is not None:
            self._game_context_tpl_b = cfg_b.game_context_template
            self._sub_obs_b = cfg_b.subgame_observation_b
            self._sub_cta_b = cfg_b.subgame_call_to_action
            self._sub_outcome_b = cfg_b.subgame_outcome
            self._meta_header_b = cfg_b.meta_game_header
            self._meta_cta_b = cfg_b.meta_game_call_to_action
        else:
            self._game_context_tpl_b = GAME_CONTEXT_TEMPLATE
            self._sub_obs_b = SUBGAME_OBSERVATION_B
            self._sub_cta_b = SUBGAME_CALL_TO_ACTION
            self._sub_outcome_b = SUBGAME_OUTCOME
            self._meta_header_b = META_GAME_HEADER
            self._meta_cta_b = META_GAME_CALL_TO_ACTION

    def _send_game_context(self):
        """Send initial game context to both agents (per-agent templates)."""
        mode_desc_str = "".join(f"  {desc}\n" for desc in MODE_DESCRIPTIONS.values())
        action_desc_str = "".join(f"  {desc}\n" for desc in ACTION_DESCRIPTIONS.values())

        concept_description = (
            "Defensive/Worst-case" if self.solution_concept == "maxmin"
            else "Aggressive/Best-case"
        )

        fmt_kwargs = dict(
            solution_concept=self.solution_concept.upper(),
            concept_description=concept_description,
            mode_descriptions=mode_desc_str,
            action_descriptions=action_desc_str,
        )
        self.agent_a.observe(self._game_context_tpl_a.format(**fmt_kwargs))
        self.agent_b.observe(self._game_context_tpl_b.format(**fmt_kwargs))

    def play_subgame(self, mode_a: str, mode_b: str) -> dict:
        """Play a single 2x2 subgame for a given mode combination."""
        mat_a = self.matrices.get(("A", mode_a, mode_b))
        mat_b = self.matrices.get(("B", mode_a, mode_b))

        if mat_a is None or mat_b is None:
            return {"error": f"No matrix data for ({mode_a}, {mode_b})"}

        matrix_info = format_payoff_matrix(self.matrices, mode_a, mode_b)
        subgame_kwargs = dict(
            mode_a=mode_a, mode_b=mode_b,
            mode_a_name=MODE_NAMES[mode_a], mode_b_name=MODE_NAMES[mode_b],
            matrix_info=matrix_info,
        )
        self.agent_a.observe(
            self._sub_obs_a.format(
                **subgame_kwargs,
                rr=mat_a[0, 0], rth=mat_a[0, 1],
                thr=mat_a[1, 0], thth=mat_a[1, 1],
            )
        )
        self.agent_b.observe(
            self._sub_obs_b.format(
                **subgame_kwargs,
                rr=mat_b[0, 0], rth=mat_b[0, 1],
                thr=mat_b[1, 0], thth=mat_b[1, 1],
            )
        )

        cta_kwargs = dict(mode_a=mode_a, mode_b=mode_b)
        spec_a = entity_lib.ActionSpec(
            call_to_action=self._sub_cta_a.format(**cta_kwargs),
            output_type=entity_lib.OutputType.CHOICE,
            options=tuple(ACTIONS),
        )
        spec_b = entity_lib.ActionSpec(
            call_to_action=self._sub_cta_b.format(**cta_kwargs),
            output_type=entity_lib.OutputType.CHOICE,
            options=tuple(ACTIONS),
        )

        action_a = self.agent_a.act(spec_a)
        action_b = self.agent_b.act(spec_b)

        row_a = ACTIONS.index(action_a)
        col_b = ACTIONS.index(action_b)
        payoff_a = float(mat_a[row_a, col_b])
        payoff_b = float(mat_b[row_a, col_b])

        result = {
            "mode_a": mode_a,
            "mode_b": mode_b,
            "action_a": action_a,
            "action_b": action_b,
            "payoff_a": payoff_a,
            "payoff_b": payoff_b,
        }

        # Capture reasoning from action logs (populated by CoT)
        log_a = self.agent_a.get_action_log()
        log_b = self.agent_b.get_action_log()
        if log_a and log_a[-1].get("info", {}).get("reasoning"):
            result["reasoning_a"] = log_a[-1]["info"]["reasoning"]
        if log_b and log_b[-1].get("info", {}).get("reasoning"):
            result["reasoning_b"] = log_b[-1]["info"]["reasoning"]

        outcome_kwargs = dict(
            mode_a=mode_a, mode_b=mode_b,
            action_a=ACTION_NAMES[action_a],
            action_b=ACTION_NAMES[action_b],
        )
        self.agent_a.observe(
            self._sub_outcome_a.format(**outcome_kwargs) + f"Your payoff: {payoff_a:.4f}"
        )
        self.agent_b.observe(
            self._sub_outcome_b.format(**outcome_kwargs) + f"Your payoff: {payoff_b:.4f}"
        )

        return result

    def play_all_subgames(self) -> dict:
        """Play all 9 subgames."""
        results = {}
        for mode_a in MODES:
            for mode_b in MODES:
                key = f"{mode_a}{mode_b}"
                result = self.play_subgame(mode_a, mode_b)
                results[key] = result
        self.subgame_results = results
        return results

    def build_meta_game_matrix(self) -> tuple[np.ndarray, np.ndarray]:
        """Build 3x3 meta-game matrix from subgame results.

        Returns (meta_A, meta_B) where meta_X[i,j] is the payoff for player X
        when A chooses MODES[i] and B chooses MODES[j].
        """
        meta_a = np.zeros((3, 3))
        meta_b = np.zeros((3, 3))

        for i, mode_a in enumerate(MODES):
            for j, mode_b in enumerate(MODES):
                key = f"{mode_a}{mode_b}"
                if key in self.subgame_results:
                    meta_a[i, j] = self.subgame_results[key]["payoff_a"]
                    meta_b[i, j] = self.subgame_results[key]["payoff_b"]

        return meta_a, meta_b

    def play_meta_game(self) -> dict:
        """Stage 2: Ask agents to choose their overall attack mode."""
        meta_a, meta_b = self.build_meta_game_matrix()

        meta_info_a = self._meta_header_a.format(player_label="Country A")
        meta_info_a += f"{'':>20} B=P        B=S        B=C\n"
        for i, mode_a in enumerate(MODES):
            meta_info_a += f"  A={mode_a:>2}:       "
            for j in range(3):
                meta_info_a += f"{meta_a[i,j]:>10.4f} "
            meta_info_a += "\n"

        meta_info_b = self._meta_header_b.format(player_label="Country B")
        meta_info_b += f"{'':>20} B=P        B=S        B=C\n"
        for i, mode_a in enumerate(MODES):
            meta_info_b += f"  A={mode_a:>2}:       "
            for j in range(3):
                meta_info_b += f"{meta_b[i,j]:>10.4f} "
            meta_info_b += "\n"

        self.agent_a.observe(meta_info_a)
        self.agent_b.observe(meta_info_b)

        mode_spec_a = entity_lib.ActionSpec(
            call_to_action=self._meta_cta_a,
            output_type=entity_lib.OutputType.CHOICE,
            options=tuple(MODES),
        )
        mode_spec_b = entity_lib.ActionSpec(
            call_to_action=self._meta_cta_b,
            output_type=entity_lib.OutputType.CHOICE,
            options=tuple(MODES),
        )

        mode_a = self.agent_a.act(mode_spec_a)
        mode_b = self.agent_b.act(mode_spec_b)

        i = MODES.index(mode_a)
        j = MODES.index(mode_b)

        self.meta_game_result = {
            "mode_a": mode_a,
            "mode_b": mode_b,
            "payoff_a": float(meta_a[i, j]),
            "payoff_b": float(meta_b[i, j]),
            "meta_matrix_a": meta_a.tolist(),
            "meta_matrix_b": meta_b.tolist(),
        }

        # Capture reasoning from action logs (populated by CoT)
        log_a = self.agent_a.get_action_log()
        log_b = self.agent_b.get_action_log()
        if log_a and log_a[-1].get("info", {}).get("reasoning"):
            self.meta_game_result["reasoning_a"] = log_a[-1]["info"]["reasoning"]
        if log_b and log_b[-1].get("info", {}).get("reasoning"):
            self.meta_game_result["reasoning_b"] = log_b[-1]["info"]["reasoning"]

        return self.meta_game_result

    def run_full_game(self) -> dict:
        """Run the complete two-stage game."""
        self._send_game_context()
        subgame_results = self.play_all_subgames()
        meta_result = self.play_meta_game()

        # Determine world state
        subgame_key = f"{meta_result['mode_a']}{meta_result['mode_b']}"
        if subgame_key in subgame_results:
            a_action = subgame_results[subgame_key]["action_a"]
            b_action = subgame_results[subgame_key]["action_b"]
            if a_action == "R" and b_action == "R":
                world_state = "Mutual Conflict"
            elif a_action == "Th" and b_action == "Th":
                world_state = "Mutual Deterrence"
            elif a_action == "R":
                world_state = "Asymmetric (A attacks, B threatens)"
            else:
                world_state = "Asymmetric (A threatens, B attacks)"
        else:
            world_state = "Unknown"

        return {
            "subgames": subgame_results,
            "meta_game": meta_result,
            "world_state": world_state,
        }
