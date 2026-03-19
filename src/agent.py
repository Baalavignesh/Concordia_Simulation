"""Concordia-based LLM agent for the cyber wargame."""

from typing import override

from concordia.language_model import language_model
from concordia.typing import entity as entity_lib

from src.constants import (
    AGENT_CHOICE_PROMPT as DEFAULT_CHOICE_PROMPT,
    AGENT_FREE_PROMPT as DEFAULT_FREE_PROMPT,
)


class CyberWarAgent(entity_lib.Entity):
    """A Concordia Entity representing a country in the cyber wargame.

    Uses an LLM to reason about strategic choices given payoff matrices
    and game context. Maintains memory of observations.
    """

    def __init__(
        self,
        agent_name: str,
        player_id: str,  # "A" or "B"
        llm: language_model.LanguageModel,
        risk_orientation: str = "risk-neutral",
        choice_prompt_template: str | None = None,
        free_prompt_template: str | None = None,
        cot: bool = False,
    ):
        self._name = agent_name
        self._player_id = player_id
        self._llm = llm
        self._risk_orientation = risk_orientation
        self._observations: list[str] = []
        self._action_log: list[dict] = []
        self._choice_prompt = choice_prompt_template or DEFAULT_CHOICE_PROMPT
        self._free_prompt = free_prompt_template or DEFAULT_FREE_PROMPT
        self._cot = cot

    @override
    @property
    def name(self) -> str:
        return self._name

    @override
    def observe(self, observation: str) -> None:
        """Process an observation from the game controller."""
        self._observations.append(observation)

    @override
    def act(self, action_spec: entity_lib.ActionSpec = entity_lib.DEFAULT_ACTION_SPEC) -> str:
        """Choose an action based on observations and the action spec."""
        context = "\n".join(self._observations[-10:])

        if action_spec.output_type == entity_lib.OutputType.CHOICE:
            prompt = self._build_choice_prompt(context, action_spec)
            if self._cot and hasattr(self._llm, "sample_choice_cot"):
                idx, choice, info = self._llm.sample_choice_cot(prompt, action_spec.options)
            else:
                idx, choice, info = self._llm.sample_choice(prompt, action_spec.options)
            self._action_log.append({
                "action": choice,
                "options": list(action_spec.options),
                "info": info,
            })
            return choice
        else:
            prompt = self._build_free_prompt(context, action_spec)
            response = self._llm.sample_text(prompt, max_tokens=500)
            self._action_log.append({"action": response})
            return response

    def _build_choice_prompt(self, context: str, action_spec: entity_lib.ActionSpec) -> str:
        return self._choice_prompt.format(
            agent_name=self._name,
            player_id=self._player_id,
            risk_orientation=self._risk_orientation,
            context=context,
            call_to_action=action_spec.call_to_action,
            options=list(action_spec.options),
        )

    def _build_free_prompt(self, context: str, action_spec: entity_lib.ActionSpec) -> str:
        return self._free_prompt.format(
            agent_name=self._name,
            player_id=self._player_id,
            risk_orientation=self._risk_orientation,
            context=context,
            call_to_action=action_spec.call_to_action,
        )

    def get_action_log(self) -> list[dict]:
        return self._action_log

    def reset(self):
        """Reset agent state for a new run."""
        self._observations.clear()
        self._action_log.clear()
