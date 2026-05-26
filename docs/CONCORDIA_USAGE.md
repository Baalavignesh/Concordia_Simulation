# Where Concordia Is Used -- And How It Helps

## What Is Concordia?

Concordia is Google DeepMind's open-source framework for building **LLM-powered agent simulations**. It provides standardized interfaces for:

1. **Agents** (called "Entities") -- that perceive the world and decide actions
2. **Language Models** -- that power agent reasoning
3. **Action Specifications** -- that define what choices are available to agents

Concordia does **NOT** provide game-theory concepts like payoff matrices or Nash equilibria -- those are built by us on top of it.

---

## The Three Concordia Pieces Used

### 1. `language_model.LanguageModel` -- The LLM Interface

```python
from concordia.language_model import language_model
```

**What it is:** An abstract base class that defines a standard interface for any LLM backend.

**How we use it:** Both of our LLM backends extend this class:

| Backend Class     | File                              | Purpose                          |
|-------------------|-----------------------------------|----------------------------------|
| `GeminiBackend`   | `src/backends/gemini_backend.py`  | Google Gemini 2.5 Flash (default)|
| `OllamaBackend`   | `src/backends/ollama_backend.py`  | Free local LLM (llama3.2)       |

Each backend implements two required methods:

```python
sample_text(prompt, ...)    -> str           # Free-form text generation
sample_choice(prompt, ...)  -> (idx, choice) # Pick from a list of options
```

**Why it helps:** By using Concordia's `LanguageModel` interface, we can **swap LLM backends freely** without changing any agent or game logic. The agents don't care if they're powered by Gemini or Ollama -- they just call the same interface.

The factory function `get_llm_backend()` in `src/backends/__init__.py` handles instantiation based on the `--backend` CLI flag.

---

### 2. `entity_lib.Entity` -- The Agent Interface

```python
from concordia.typing import entity as entity_lib
```

**What it is:** An abstract base class that defines what an "agent" looks like in Concordia.

**How we use it:** Our `CyberWarAgent` class in `src/agent.py` extends `entity_lib.Entity`:

```python
class CyberWarAgent(entity_lib.Entity):
```

It implements three required methods from the Entity interface:

| Method                   | What it does                                             |
|--------------------------|----------------------------------------------------------|
| `name` (property)        | Returns the agent's name (e.g., "Country_A")             |
| `observe(observation)`   | Receives information from the game controller            |
| `act(action_spec)`       | Makes a decision based on accumulated observations       |

**Why it helps:**
- **Standardized agent contract** -- Any Concordia-compatible tool, visualization, or engine can work with our agents because they follow the standard `Entity` interface.
- **Separation of concerns** -- The agent handles *reasoning* (how to decide), while the game controller handles *rules* (what happens after the decision). They communicate through `observe()` and `act()`.
- **Memory via observations** -- The `observe()` method accumulates context. When `act()` is called, it uses the last 10 observations to build a prompt, giving the agent a form of short-term memory.

---

### 3. `entity_lib.ActionSpec` & `entity_lib.OutputType` -- Structured Action Requests

**What they are:** Data classes that tell an agent *what kind of response* is expected.

**How we use them:** Every time the game controller (`src/controller.py`) asks an agent to make a decision:

```python
action_spec = entity_lib.ActionSpec(
    call_to_action="In subgame (P vs S), choose your action...",
    output_type=entity_lib.OutputType.CHOICE,   # Multiple-choice
    options=("R", "Th"),                         # The valid options
)
action = agent.act(action_spec)  # Returns "R" or "Th"
```

This is used in **two places**:

1. **Stage 1 (Subgames)** -- Choose between `"R"` (Attack) or `"Th"` (Threaten)
2. **Stage 2 (Meta-game)** -- Choose between `"P"`, `"S"`, or `"C"` (mode selection)

**Why it helps:**
- **Constrained outputs** -- Instead of hoping the LLM returns a parseable answer, `ActionSpec` with `OutputType.CHOICE` explicitly constrains the response to one of the provided options.
- **Clean parsing** -- The `sample_choice` method on the LLM backend handles matching the LLM's natural language output to one of the allowed options.

---

## What Is NOT From Concordia (Our Custom Code)

Everything else is **our own game logic** built on top of Concordia:

| Component                         | File                    | Description                                              |
|-----------------------------------|-------------------------|----------------------------------------------------------|
| `load_payoff_matrices()`          | `src/data_loader.py`    | Loads CSV payoff data from disk                          |
| `format_payoff_matrix()`          | `src/data_loader.py`    | Formats matrices as readable strings for agent prompts   |
| `CyberWargameController`         | `src/controller.py`     | Orchestrates the two-stage game (9 subgames + meta-game) |
| `compute_analytical_equilibria()` | `src/analysis.py`       | Computes Nash equilibria analytically (no LLM needed)    |
| `analyze_results()`              | `src/analysis.py`       | Aggregates and summarizes results across multiple runs   |
| `run_simulation()`               | `main.py`               | Main loop: creates agents, runs games, saves results     |
| Constants & config                | `src/constants.py`      | Modes, actions, descriptions, file paths                 |

---

## Visual Summary

```
+-------------------------------------------------------------+
|                        OUR CODE                              |
|                                                              |
|  +------------------------+   +------------------------+    |
|  | CyberWargameController |   |   Analysis Functions   |    |
|  | src/controller.py      |   |   src/analysis.py      |    |
|  |  - play_subgame()      |   |   - Nash equilibria    |    |
|  |  - play_meta_game()    |   |   - Result aggregation |    |
|  |  - run_full_game()     |   |                        |    |
|  +-----------+------------+   +------------------------+    |
|              |                                               |
|      observe() / act()                                       |
|              |                                               |
+--------------+-----------------------------------------------+
|              v          CONCORDIA FRAMEWORK                   |
|                                                              |
|  +--------------------+  +------------------------------+   |
|  | entity_lib.Entity  |  | language_model.LanguageModel |   |
|  | ----------------   |  | ----------------------------  |   |
|  | - name             |  | - sample_text()              |   |
|  | - observe()        |  | - sample_choice()            |   |
|  | - act(ActionSpec)  |  |                              |   |
|  +--------------------+  +------------------------------+   |
|                                                              |
|  +------------------------------------------------------+   |
|  |  entity_lib.ActionSpec + OutputType                    |   |
|  |  - call_to_action (prompt text)                       |   |
|  |  - output_type (CHOICE or FREE_FORM)                  |   |
|  |  - options (tuple of valid choices)                    |   |
|  +------------------------------------------------------+   |
+--------------------------------------------------------------+
```

## TL;DR

Concordia provides **three things** in this project:

1. **`LanguageModel`** -- A plug-and-play interface so we can swap LLMs without changing game logic
2. **`Entity`** -- A standardized agent with `observe()`/`act()` so the game controller and agents communicate cleanly
3. **`ActionSpec`** -- A structured way to ask agents multiple-choice questions and get reliable parsed answers

Everything else -- the game rules, payoff matrices, two-stage structure, analysis -- is **our custom code** built on top of these three building blocks.
