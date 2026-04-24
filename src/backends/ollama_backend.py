"""Ollama local LLM backend."""

import os
import re
import time
from collections.abc import Collection, Mapping, Sequence
from typing import Any, override

from concordia.language_model import language_model


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


def _strip_think_tags(text: str) -> str:
    """Remove <think>...</think> blocks from DeepSeek-R1 style output.

    These models emit internal reasoning in <think> tags before the actual
    response. We want to capture only the visible response for action parsing,
    but preserve the think content separately for CoT logging.
    """
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def _extract_think_content(text: str) -> str:
    """Extract the content inside <think>...</think> tags."""
    matches = re.findall(r"<think>(.*?)</think>", text, flags=re.DOTALL)
    return "\n".join(m.strip() for m in matches)


class OllamaBackend(language_model.LanguageModel):
    """Wrapper around Ollama for local LLM inference.

    Requires Ollama to be installed and running (https://ollama.com).
    Uses the Ollama HTTP API at localhost:11434.
    """

    def __init__(self, model: str | None = None):
        self._model = model or os.environ.get("OLLAMA_MODEL", "deepseek-r1:14b")
        self._base_url = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

        # Verify Ollama is reachable and model is available
        try:
            import requests
            resp = requests.get(f"{self._base_url}/api/tags", timeout=5)
            resp.raise_for_status()
            available = [m["name"] for m in resp.json().get("models", [])]
            # Normalize: "deepseek-r1:14b" matches "deepseek-r1:14b"
            model_base = self._model.split(":")[0]
            found = any(model_base in m for m in available)
            if not found:
                print(f"[Ollama] WARNING: Model '{self._model}' not found locally.")
                print(f"[Ollama] Available: {available}")
                print(f"[Ollama] Run: ollama pull {self._model}")
            else:
                print(f"[Ollama] Connected. Using model: {self._model}")
        except Exception as e:
            raise RuntimeError(
                f"Cannot connect to Ollama at {self._base_url}. "
                f"Make sure Ollama is running: https://ollama.com\n"
                f"Error: {e}"
            )

        # Warm up: force the model to load into memory now, before simulation
        # begins. The 14B model takes ~90s to load and needs ~9GB of memory.
        # Loading it here fails fast with a clear error rather than crashing
        # mid-simulation. keep_alive=-1 keeps it pinned in memory indefinitely.
        # Skip warmup if the model is already loaded (e.g. from previous config).
        try:
            import requests
            ps_resp = requests.get(f"{self._base_url}/api/ps", timeout=5)
            loaded = [m["name"] for m in ps_resp.json().get("models", [])]
            model_base = self._model.split(":")[0]
            already_loaded = any(model_base in m for m in loaded)
        except Exception:
            already_loaded = False

        if already_loaded:
            print(f"[Ollama] Model already in memory, skipping warmup.")
        else:
            print(f"[Ollama] Warming up model (this may take ~90s on first load)...")
            try:
                import requests
                warmup_payload = {
                    "model": self._model,
                    "prompt": "Ready.",
                    "stream": False,
                    "keep_alive": -1,
                    "think": False,
                    "options": {"num_predict": 1, "temperature": 0.0},
                }
                resp = requests.post(
                    f"{self._base_url}/api/generate",
                    json=warmup_payload,
                    timeout=300,
                )
                resp.raise_for_status()
                print(f"[Ollama] Model loaded and ready.")
            except Exception as e:
                raise RuntimeError(
                    f"[Ollama] Model failed to load during warmup. "
                    f"Close other applications to free RAM and try again.\n"
                    f"Error: {e}"
                )

    def _generate(
        self,
        prompt: str,
        *,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        think: bool = False,
    ) -> str:
        """Call the Ollama generate API."""
        import requests

        payload = {
            "model": self._model,
            "prompt": prompt,
            "stream": False,
            "keep_alive": -1,  # Keep model pinned in memory between calls
            "think": think,    # False = skip DeepSeek-R1 reasoning chain for fast calls
            "options": {
                "num_predict": max_tokens,
                "temperature": temperature,
            },
        }

        max_retries = 5
        for attempt in range(max_retries):
            try:
                resp = requests.post(
                    f"{self._base_url}/api/generate",
                    json=payload,
                    timeout=600,  # 600s: CoT calls with max_tokens=4096 can be lengthy
                )
                resp.raise_for_status()
                return resp.json().get("response", "")
            except requests.exceptions.Timeout:
                if attempt < max_retries - 1:
                    wait = 5 * (attempt + 1)
                    print(f"  [Ollama] Timeout, retrying in {wait}s (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(wait)
                else:
                    raise RuntimeError(
                        f"Ollama timed out after {max_retries} attempts. "
                        f"The model may be too large for your hardware."
                    )
            except requests.exceptions.HTTPError as e:
                if attempt < max_retries - 1:
                    wait = 15 * (attempt + 1)
                    print(f"  [Ollama] HTTP {e.response.status_code} error (runner may have crashed), retrying in {wait}s (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(wait)
                else:
                    raise RuntimeError(
                        f"Ollama returned HTTP error after {max_retries} attempts: {e}"
                    )
            except requests.exceptions.ConnectionError:
                if attempt < max_retries - 1:
                    wait = 10 * (attempt + 1)
                    print(f"  [Ollama] Connection lost, retrying in {wait}s (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(wait)
                else:
                    raise RuntimeError(
                        f"Lost connection to Ollama at {self._base_url}. "
                        f"Is it still running?"
                    )

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
        result = self._generate(prompt, max_tokens=max_tokens, temperature=temperature)
        # Strip <think> tags for normal text output
        return _strip_think_tags(result)

    @override
    def sample_choice(
        self,
        prompt: str,
        responses: Sequence[str],
        *,
        seed: int | None = None,
    ) -> tuple[int, str, Mapping[str, Any]]:
        full_prompt = (
            f"{prompt}\n\n"
            f"You must respond with EXACTLY one of these options: {list(responses)}\n"
            f"Respond with only the option, nothing else."
        )
        raw = self._generate(full_prompt, max_tokens=100, temperature=0.2, think=False)
        result = _strip_think_tags(raw)

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
        """Chain-of-Thought choice: reason first, then pick.

        For models with built-in thinking (DeepSeek-R1), the <think> block
        IS the reasoning — we extract it directly instead of discarding it.
        For other models, we ask them to reason explicitly in the prompt.
        """
        reasoning_prompt = (
            f"{prompt}\n\n"
            f"Available options: {list(responses)}\n\n"
            "Think through this decision step by step. Analyze the payoffs, "
            "consider your decision framework, and explain your reasoning. "
            "At the end, clearly state which option you choose and why."
        )
        raw = self._generate(reasoning_prompt, max_tokens=4096, temperature=0.4, think=True)

        # Extract reasoning: prefer <think> block if present (DeepSeek-R1),
        # otherwise the full response IS the reasoning
        think_content = _extract_think_content(raw)
        visible_response = _strip_think_tags(raw)

        if think_content:
            # DeepSeek-R1 style: thinking is in tags, answer follows
            reasoning = think_content
            choice_text = visible_response
        else:
            # Other models: the whole response contains both reasoning and choice
            reasoning = visible_response
            choice_text = visible_response

        # Try to extract the choice from the visible response first
        idx = _match_response(choice_text, responses)
        if idx is not None:
            return idx, responses[idx], {"reasoning": reasoning}

        # Fallback: ask a separate extraction call
        extraction_prompt = (
            f"Based on the following reasoning, what was the final choice?\n\n"
            f"Reasoning:\n{reasoning[-2000:]}\n\n"
            f"You must respond with EXACTLY one of these options: {list(responses)}\n"
            f"Respond with only the option, nothing else."
        )
        extract_raw = self._generate(extraction_prompt, max_tokens=20, temperature=0.0, think=False)
        extract_result = _strip_think_tags(extract_raw)

        idx = _match_response(extract_result, responses)
        if idx is not None:
            return idx, responses[idx], {"reasoning": reasoning}

        # Last resort: try matching anywhere in the full reasoning
        idx = _match_response(reasoning, responses)
        if idx is not None:
            return idx, responses[idx], {"reasoning": reasoning, "warning": f"Extracted from reasoning (parse failed: {extract_result})"}

        return 0, responses[0], {"reasoning": reasoning, "warning": f"Could not parse: {extract_result}"}
