"""Prompt configuration dataclass and loader.

Each prompt config variant defines a different decision-making persona
for the LLM agents (e.g., rational, satisficing, prospect-theory, etc.).
The PromptConfig dataclass bundles all prompt templates together so that
controller.py and agent.py can be config-driven.
"""

from __future__ import annotations

import importlib.util
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType


@dataclass(frozen=True)
class PromptConfig:
    """All prompt templates needed by the controller and agent."""

    name: str

    game_context_template: str
    subgame_observation_a: str
    subgame_observation_b: str
    subgame_call_to_action: str
    subgame_outcome: str
    meta_game_header: str
    meta_game_call_to_action: str
    agent_choice_prompt: str
    agent_free_prompt: str


# Attribute names we pull from each config module (UPPER) mapped to
# the dataclass field names (lower).
_FIELD_MAP = {
    "GAME_CONTEXT_TEMPLATE": "game_context_template",
    "SUBGAME_OBSERVATION_A": "subgame_observation_a",
    "SUBGAME_OBSERVATION_B": "subgame_observation_b",
    "SUBGAME_CALL_TO_ACTION": "subgame_call_to_action",
    "SUBGAME_OUTCOME": "subgame_outcome",
    "META_GAME_HEADER": "meta_game_header",
    "META_GAME_CALL_TO_ACTION": "meta_game_call_to_action",
    "AGENT_CHOICE_PROMPT": "agent_choice_prompt",
    "AGENT_FREE_PROMPT": "agent_free_prompt",
}


def _import_module_from_path(path: Path) -> ModuleType:
    """Import a Python module from an absolute file path."""
    spec = importlib.util.spec_from_file_location(path.stem, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load module from {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_prompt_config(path: Path) -> PromptConfig:
    """Load a PromptConfig from a config_*.py file."""
    mod = _import_module_from_path(path)
    kwargs: dict[str, str] = {}
    for attr, field in _FIELD_MAP.items():
        if not hasattr(mod, attr):
            raise AttributeError(
                f"Config file {path.name} is missing required constant: {attr}"
            )
        kwargs[field] = getattr(mod, attr)

    config_name = path.stem.removeprefix("config_")
    return PromptConfig(name=config_name, **kwargs)


def discover_prompt_configs(prompts_dir: Path) -> list[PromptConfig]:
    """Find all config_*.py files in a directory and load them."""
    configs = []
    for p in sorted(prompts_dir.glob("config_*.py")):
        configs.append(load_prompt_config(p))
    return configs
