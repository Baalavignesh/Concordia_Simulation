# CoT Reasoning Complexity Analysis

## Overview

When Chain-of-Thought (CoT) prompting is enabled, each LLM agent produces a free-text reasoning trace before making a strategic decision. This analysis parses those traces using regex-based text analysis to extract quantitative complexity metrics.

**No LLM is used in this analysis.** All metrics are derived from deterministic pattern matching on the raw reasoning text.

## How It Works

Each reasoning trace (e.g., a 150-word paragraph where Agent A explains why it chose Attack over Threaten) is passed through `_analyze_reasoning_text()` in `src/analysis.py`. This function runs 6 independent regex scans and 2 string operations, producing 8 metrics per trace.

Results are aggregated across runs (mean/std) and across subgames to produce per-config, per-concept summaries.

## Metrics and Their Regex Patterns

### 1. Word Count

```python
words = text.split()
word_count = len(words)
```

**What it measures:** Total length of the reasoning trace.

**Why it matters:** Longer traces suggest the agent found the decision harder and needed more deliberation. A 30-word trace ("Attack dominates, choose Attack") indicates a straightforward decision. A 200-word trace with multiple paragraphs suggests genuine complexity.

**Limitations:** Verbosity is not the same as depth. A verbose but repetitive trace may score high without being meaningfully complex.

---

### 2. Sentence Count

```python
sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
sentence_count = len(sentences)
```

**Pattern:** `[.!?]+` — splits on one or more sentence-ending punctuation marks.

**What it measures:** Number of distinct sentences in the trace.

**Why it matters:** More sentences generally means more distinct reasoning steps or considerations. Combined with word count, it gives a sense of whether the agent is writing long compound sentences or many short declarative ones.

---

### 3. Step Count

```python
step_markers = re.findall(
    r'(?:^|\n)\s*(?:\d+[\.\):]|[-*]|step\s+\d+)', text, re.IGNORECASE
)
step_count = len(step_markers)
```

**Pattern breakdown:**
- `(?:^|\n)\s*` — match at start of text or after a newline, allowing leading whitespace
- `\d+[\.\):]` — numbered lists like `1.`, `2)`, `3:`
- `[-*]` — bullet points using dashes or asterisks (note: `*` is the literal Unicode bullet character, not asterisk)
- `step\s+\d+` — explicit "Step 1", "Step 2" markers

**What it measures:** How many explicit reasoning steps the agent lays out.

**Why it matters:** Structured step-by-step reasoning indicates the agent is decomposing the problem. Higher step counts suggest the agent perceives the problem as requiring multi-part analysis rather than a single intuitive judgment.

**Limitations:** Some agents reason in prose paragraphs without numbered steps. A low step count doesn't necessarily mean shallow reasoning — it may just mean unstructured reasoning.

---

### 4. Numeric References

```python
numeric_refs = re.findall(r'-?\d+\.?\d*', text)
numeric_ref_count = len(numeric_refs)
```

**Pattern:** `-?\d+\.?\d*` — matches integers and decimals, optionally negative.

**Examples matched:** `0.9000`, `-2.67`, `3`, `-63.00`

**What it measures:** How often the agent references specific numbers (typically payoff values from the game matrices).

**Why it matters:** An agent that cites actual payoff numbers is grounding its reasoning in the data rather than relying on heuristics or persona-driven intuition. Higher numeric reference counts suggest more analytical, payoff-driven reasoning.

**Limitations:** This pattern also matches numbers in step markers ("Step 1"), dates, or other non-payoff numbers. In practice, payoff references dominate because the reasoning traces are specifically about strategic choices with numeric payoffs.

---

### 5. Opponent Mentions

```python
opponent_keywords = [
    'opponent', 'other country', 'country a', 'country b',
    'they', 'their', 'adversary', 'rival',
]
opponent_mentions = sum(
    len(re.findall(rf'\b{kw}\b', text, re.IGNORECASE))
    for kw in opponent_keywords
)
```

**Pattern:** `\b{keyword}\b` with `re.IGNORECASE` — word-boundary-delimited, case-insensitive match for each keyword.

**Keywords and rationale:**
| Keyword | Why included |
|---|---|
| `opponent` | Direct reference to the other player |
| `other country` | Game-specific phrasing |
| `country a` / `country b` | Explicit player references |
| `they` / `their` | Pronoun references to opponent |
| `adversary` / `rival` | Antagonistic framing |

**What it measures:** Theory-of-mind depth — whether the agent considers what the other player might do.

**Why it matters:** Game theory is inherently about strategic interaction. An agent that never mentions the opponent is reasoning in isolation (dominance-seeking), while one that frequently references the opponent is engaging in strategic thinking (best-response reasoning).

**Key finding:** Retaliatory agents score highest on opponent modeling but lowest on dominance recognition — they obsess over the opponent but still make poor strategic choices.

**Limitations:** Pronoun matching (`they`/`their`) can produce false positives if the agent uses these words to refer to actions or outcomes rather than the opponent.

---

### 6. Hedge Count (Uncertainty Language)

```python
hedge_keywords = [
    'however', 'but', 'although', 'on the other hand',
    'uncertain', 'risk', 'might', 'could', 'possibly',
    'trade-off', 'tradeoff', 'depends',
]
hedge_count = sum(
    len(re.findall(rf'\b{kw}\b', text, re.IGNORECASE))
    for kw in hedge_keywords
)
```

**Keywords grouped by function:**

| Category | Keywords | What they signal |
|---|---|---|
| Contrast/concession | `however`, `but`, `although`, `on the other hand` | The agent considered an alternative and is qualifying its reasoning |
| Epistemic uncertainty | `uncertain`, `might`, `could`, `possibly` | The agent is unsure about outcomes or opponent behavior |
| Decision tension | `risk`, `trade-off`, `tradeoff`, `depends` | The agent recognizes competing objectives |

**What it measures:** How much uncertainty or deliberative tension the agent expresses.

**Why it matters:** High hedging suggests the agent sees the decision as genuinely difficult — there are trade-offs, the outcome depends on the opponent, or the agent is unsure. Low hedging suggests the agent sees a clear-cut choice.

**Key finding:** Prospect Theory agents hedge the most, consistent with their loss-aversion framing that makes them weigh potential downsides more heavily.

---

### 7. Dominance Recognition

```python
dominance_keywords = [
    'dominant', 'dominates', 'strictly dominant',
    'always better', 'regardless',
]
recognizes_dominance = any(
    re.search(rf'\b{kw}\b', text, re.IGNORECASE)
    for kw in dominance_keywords
)
```

**Pattern:** Same word-boundary matching, but uses `any()` — returns a boolean (True/False) rather than a count.

**Keywords and rationale:**
| Keyword | What it signals |
|---|---|
| `dominant` / `dominates` | Explicit game-theory terminology |
| `strictly dominant` | Formal recognition of strict dominance |
| `always better` | Informal equivalent of dominance |
| `regardless` | "This is better regardless of what the opponent does" = dominance definition |

**What it measures:** Whether the agent identifies a dominant strategy in the subgame (a strategy that is optimal no matter what the opponent does).

**Why it matters:** Most 2x2 subgames in this simulation have a dominant strategy. An agent that recognizes dominance is engaging in correct game-theoretic reasoning. One that doesn't may be using heuristics, persona-driven biases, or flawed analysis.

**Key finding:** Rational agents recognize dominance 83-89% of the time. Retaliatory agents: 0%. This is the single most discriminating metric between persona types.

**Output:** Boolean (True/False), aggregated as a fraction across runs (e.g., 0.83 = recognized in 83% of traces).

---

### 8. Comparison Count (Deliberation)

```python
comparison_keywords = [
    'compare', 'versus', 'vs', 'better than', 'worse than',
    'higher', 'lower', 'prefer', 'alternative',
]
comparison_count = sum(
    len(re.findall(rf'\b{kw}\b', text, re.IGNORECASE))
    for kw in comparison_keywords
)
```

**Keywords and rationale:**
| Keyword | What it signals |
|---|---|
| `compare` / `versus` / `vs` | Explicit comparison between options |
| `better than` / `worse than` | Relative evaluation |
| `higher` / `lower` | Payoff comparison |
| `prefer` | Preference statement |
| `alternative` | Considering other options |

**What it measures:** How actively the agent weighs alternatives against each other.

**Why it matters:** An agent that compares options is engaging in deliberative reasoning rather than jumping to a conclusion. High comparison counts suggest the agent evaluated multiple strategies before choosing.

---

## Aggregation

After extracting metrics from each individual trace, results are aggregated:

1. **Per-subgame, per-player:** Mean and standard deviation across runs (e.g., "In the PP subgame, Agent A averaged 154 words with std 0.0")
2. **Per-config, per-concept:** Averaged across all 9 subgames and both players to produce a single summary row
3. **Complexity ranking:** Subgames ranked by average word count (both players combined), indicating which mode combinations are hardest to reason about

## Running the Analysis

```bash
# Analyze all CoT result files
python3 analyze_cot.py

# Analyze specific files
python3 analyze_cot.py dashboard/public/data/v1_rational_eut_cot.json

# Custom output path
python3 analyze_cot.py --output results/my_analysis.json
```

Output is saved to `dashboard/public/data/cot_complexity_analysis.json` by default and displayed on the **Reasoning Complexity** tab in the dashboard.

## Known Limitations

1. **Surface-level only:** Regex counts word presence, not whether the reasoning is logically correct or coherent.
2. **Keyword lists are hand-crafted:** They may miss synonyms or domain-specific phrasings not anticipated.
3. **False positives:** `they`/`their` may refer to things other than the opponent. Numbers in step markers inflate `numeric_references`.
4. **No semantic understanding:** "Attack is dominant" and "Attack is not dominant" both trigger `recognizes_dominance = True`.
5. **Language-dependent:** Keywords are English-only. Non-English reasoning traces would require translated keyword lists.

## Potential Extensions

- **LLM-as-judge:** Use an LLM to assess reasoning *quality* (logical coherence, correctness of payoff analysis) rather than just surface features.
- **Reasoning correctness:** Compare the agent's cited payoff values against the actual matrix values to check if it read the matrix correctly.
- **Sentiment analysis:** Measure emotional tone (aggressive vs. cautious language) as an additional persona signal.
- **Trace clustering:** Use embedding similarity to group reasoning traces and identify distinct reasoning "strategies" across configs.
