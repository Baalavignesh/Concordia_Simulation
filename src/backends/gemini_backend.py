"""Google Gemini LLM backend."""

import os
import re
import time
from collections.abc import Collection, Mapping, Sequence
from pathlib import Path
from typing import Any, override

from concordia.language_model import language_model


def _load_dotenv():
    """Load GEMINI_API_KEY from .env file if not already in environment."""
    if os.environ.get("GEMINI_API_KEY"):
        return
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    os.environ.setdefault(key.strip(), value.strip())


# Map full action names back to short codes for fuzzy matching
_ACTION_ALIASES = {
    "attack": "R",
    "threaten": "Th",
    "threat": "Th",
    "private actor": "P",
    "state unit": "S",
    "coalition": "C",
}


def _match_response(result: str, responses: Sequence[str]) -> int | None:
    """Match LLM output to one of the valid responses.

    Uses a three-tier strategy:
    1. Exact match (case-insensitive)
    2. Word-boundary regex (prevents single-letter 'r' matching inside words)
    3. Alias match (e.g. 'Threaten' → 'Th', 'Attack' → 'R')

    Returns the index into responses, or None if no match.
    """
    cleaned = result.strip().lower()
    # Tier 1: exact match
    for i, resp in enumerate(responses):
        if cleaned == resp.lower():
            return i
    # Tier 2: word-boundary match
    for i, resp in enumerate(responses):
        if re.search(r'\b' + re.escape(resp) + r'\b', result, re.IGNORECASE):
            return i
    # Tier 3: alias match (handles 'Threaten', 'Attack', etc.)
    for alias, code in _ACTION_ALIASES.items():
        if alias in cleaned:
            for i, resp in enumerate(responses):
                if resp.lower() == code.lower():
                    return i
    return None


class GeminiBackend(language_model.LanguageModel):
    """Wrapper around Google Gemini using the google-genai SDK."""

    def __init__(self, api_key: str | None = None, model: str = "gemini-2.5-flash"):
        try:
            from google import genai

            _load_dotenv()
            self._api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
            if not self._api_key:
                raise ValueError(
                    "Set GEMINI_API_KEY environment variable or pass api_key. "
                    "Get a free key at: https://aistudio.google.com/apikey"
                )
            self._client = genai.Client(api_key=self._api_key)
            self._model = model
            print(f"[Gemini] Connected. Using model: {model}")
        except ImportError:
            raise RuntimeError(
                "google-genai not installed. Run:\n"
                "pip install google-genai"
            )

    def _generate(
        self,
        prompt: str,
        *,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        top_p: float = 0.95,
        top_k: int = 64,
        thinking_budget: int | None = None,
    ) -> str:
        """Core generation method shared by sample_text and no-thinking variant.

        Args:
            thinking_budget: If set, controls the thinking model's internal
                reasoning budget. Use 0 to disable thinking entirely (all
                tokens go to visible output). If None, uses the model default.
        """
        from google.genai import types
        from google.genai.errors import ServerError

        config_kwargs = dict(
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            max_output_tokens=max_tokens,
        )
        if thinking_budget is not None:
            config_kwargs["thinking_config"] = types.ThinkingConfig(
                thinking_budget=thinking_budget,
            )

        max_retries = 5
        for attempt in range(max_retries):
            try:
                response = self._client.models.generate_content(
                    model=self._model,
                    contents=prompt,
                    config=types.GenerateContentConfig(**config_kwargs),
                )
                return response.text
            except ServerError as e:
                if attempt < max_retries - 1:
                    wait = 2 ** attempt * 5  # 5s, 10s, 20s, 40s
                    print(f"  [Gemini] {e.status_code} error, retrying in {wait}s (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(wait)
                else:
                    raise

    @override
    def sample_text(
        self,
        prompt: str,
        *,
        max_tokens: int = 2000,
        terminators: Collection[str] = (),
        temperature: float = 0.7,
        top_p: float = 0.95,
        top_k: int = 64,
        timeout: float = 120,
        seed: int | None = None,
    ) -> str:
        return self._generate(
            prompt, max_tokens=max_tokens,
            temperature=temperature, top_p=top_p, top_k=top_k,
        )

    def _sample_text_no_thinking(
        self,
        prompt: str,
        *,
        max_tokens: int = 8192,
        temperature: float = 0.4,
    ) -> str:
        """Generate text with the model's built-in thinking disabled.

        Used for CoT reasoning where the prompt already asks the LLM to
        think step-by-step. Disabling the model's internal thinking ensures
        all output tokens go to the visible response instead of being consumed
        by hidden reasoning.
        """
        return self._generate(
            prompt, max_tokens=max_tokens,
            temperature=temperature, thinking_budget=0,
        )

    @override
    def sample_choice(
        self,
        prompt: str,
        responses: Sequence[str],
        *,
        seed: int | None = None,
    ) -> tuple[int, str, Mapping[str, Any]]:
        full_prompt = (
            f"{prompt}\n\nYou must respond with EXACTLY one of these options: "
            f"{responses}\nRespond with only the option, nothing else."
        )
        result = self.sample_text(full_prompt, temperature=0.2)
        result = result.strip()
        idx = _match_response(result, responses)
        if idx is not None:
            return idx, responses[idx], {}
        return 0, responses[0], {"warning": f"Could not parse: {result}"}

    def sample_choice_cot(
        self,
        prompt: str,
        responses: Sequence[str],
        *,
        seed: int | None = None,
    ) -> tuple[int, str, Mapping[str, Any]]:
        """Two-step Chain-of-Thought choice: reason first, then pick.

        Uses a large max_output_tokens budget (8192) because thinking models
        like gemini-2.5-flash share the budget between internal thinking tokens
        and visible output. With only 1000 tokens, most get consumed by
        internal reasoning, leaving the visible CoT truncated to ~140 chars.
        """
        from google.genai import types

        # Step 1: Ask the LLM to reason through the decision
        reasoning_prompt = (
            f"{prompt}\n\n"
            f"Available options: {list(responses)}\n\n"
            "Think through this decision step by step. Analyze the payoffs, "
            "consider your decision framework, and explain your reasoning. "
            "At the end, state which option you choose and why."
        )
        reasoning = self._sample_text_no_thinking(
            reasoning_prompt, max_tokens=8192, temperature=0.4,
        )
        reasoning = reasoning or ""

        # Step 2: Extract the final choice from the reasoning
        extraction_prompt = (
            f"Based on the following reasoning, what was the final choice?\n\n"
            f"Reasoning:\n{reasoning}\n\n"
            f"You must respond with EXACTLY one of these options: {list(responses)}\n"
            f"Respond with only the option, nothing else."
        )
        result = self.sample_text(extraction_prompt, max_tokens=10, temperature=0.0)
        result = (result or "").strip()

        # Match from extraction result
        idx = _match_response(result, responses)
        if idx is not None:
            return idx, responses[idx], {"reasoning": reasoning}
        # Fallback: try to find the choice directly in the reasoning
        idx = _match_response(reasoning, responses)
        if idx is not None:
            return idx, responses[idx], {"reasoning": reasoning, "warning": f"Extracted from reasoning (parse failed: {result})"}
        return 0, responses[0], {"reasoning": reasoning, "warning": f"Could not parse: {result}"}
