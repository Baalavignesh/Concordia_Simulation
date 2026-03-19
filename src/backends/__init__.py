"""LLM backend abstraction layer."""

import os

from concordia.language_model import language_model

from src.backends.gemini_backend import GeminiBackend


def get_llm_backend(backend_name: str = "gemini") -> language_model.LanguageModel:
    """Initialize the LLM backend."""
    if backend_name == "gemini":
        return GeminiBackend()
    elif backend_name == "ollama":
        from src.backends.ollama_backend import OllamaBackend
        return OllamaBackend()
    else:
        raise ValueError(f"Unknown backend: {backend_name}. Use: gemini, ollama")
