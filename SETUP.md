# Setup Guide

Run all simulations on a fresh machine. Tested on macOS (Apple Silicon).

---

## 1. Prerequisites

```bash
# Python 3.12+
python3 --version

# Node.js 20+ (for dashboard only)
node --version

# Ollama (local LLM inference)
brew install ollama
```

## 2. Install Dependencies

```bash
# Python packages
pip3 install gdm-concordia google-genai requests

# Pull the LLM model (~9GB download)
ollama pull deepseek-r1:14b

# Dashboard (optional, for visualization)
cd dashboard && npm install && cd ..
```

## 3. Start Ollama

Open a separate terminal and keep it running:

```bash
ollama serve
```

Verify it's working:

```bash
curl http://localhost:11434/api/tags
```

You should see `deepseek-r1:14b` in the model list.

## 4. Run Simulations

Symmetric runs (same persona for both agents) and their CoT variants already have results in `results/`. Only the cross-play asymmetric matchups need to be run.

### Cross-play asymmetric matchups (20 matchups)

```bash
# All 20 asymmetric pairs, both concepts, 1 run each
# ~8-9 hours total
python3 main.py --cross-play-asymmetric
```

This produces:
```
results/crossplay/v1_rational_eut_vs_v2_bounded_satisficing/simulation_results.json
results/crossplay/v1_rational_eut_vs_v3_bounded_prospect_theory/simulation_results.json
... (20 directories total)
```

### Cross-play with Chain-of-Thought

```bash
# All 20 asymmetric pairs with CoT
# ~20-25 hours total
python3 main.py --cross-play-asymmetric --cot
```

### Total estimated time: ~28-34 hours

To run both back-to-back unattended:

```bash
nohup bash -c '
python3 main.py --cross-play-asymmetric && \
python3 main.py --cross-play-asymmetric --cot
' > simulation_log.txt 2>&1 &

# Monitor progress
tail -f simulation_log.txt
```

## 5. Copy Results to Dashboard

After simulations complete, copy result files into the dashboard's public data directory:

```bash
# Symmetric results
for dir in results/v*/; do
  config=$(basename "$dir")
  cp "$dir/simulation_results.json" "dashboard/public/data/${config}.json" 2>/dev/null
  cp "$dir/simulation_results_cot.json" "dashboard/public/data/${config}_cot.json" 2>/dev/null
done

# Cross-play results
mkdir -p dashboard/public/data/crossplay
for dir in results/crossplay/*/; do
  matchup=$(basename "$dir")
  cp "$dir/simulation_results.json" "dashboard/public/data/crossplay/${matchup}.json" 2>/dev/null
  cp "$dir/simulation_results_cot.json" "dashboard/public/data/crossplay/${matchup}_cot.json" 2>/dev/null
done
```

## 6. Launch Dashboard

```bash
cd dashboard
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Quick Reference

| Command | What it does | Time |
|---------|-------------|------|
| `python3 main.py` | 5 symmetric configs (already done) | ~2h |
| `python3 main.py --cot` | Same with CoT (already done) | ~5h |
| `python3 main.py --cross-play-asymmetric` | 20 asymmetric matchups | ~8-9h |
| `python3 main.py --cross-play-asymmetric --cot` | 20 matchups with CoT | ~20-25h |
| `python3 main.py --cross-play` | All 25 matchups (includes mirrors) | ~10-11h |
| `python3 main.py --config-a X --config-b Y` | Single matchup | ~25min |
| `python3 main.py --config-a X --config-b Y --cot` | Single matchup with CoT | ~60-75min |

## Troubleshooting

**Ollama timeout errors:**
The model takes ~30-60 seconds per call. If you get timeouts, make sure nothing else is using the GPU. The backend retries 3 times automatically.

**"Model not found" warning:**
```bash
ollama pull deepseek-r1:14b
```

**Port 5173 already in use (dashboard):**
Vite will auto-pick the next available port. Check the terminal output.

**Want to use a different model:**
```bash
OLLAMA_MODEL=llama3.2 python3 main.py --cross-play-asymmetric
```
Note: Smaller models may not differentiate between personas well enough for meaningful cross-play results.
