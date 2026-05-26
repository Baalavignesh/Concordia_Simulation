# Running Guide

Step-by-step instructions for running simulations and viewing results. Tested on macOS (Apple Silicon).

---

## Part 1 — Running Simulations with Ollama

### Prerequisites

- Python 3.12+
- [Ollama](https://ollama.com) (local LLM inference)
- Node.js 20+ (only needed for the dashboard — see Part 2)

### 1. Install Ollama and pull the model

```bash
brew install ollama          # macOS

# In a separate terminal — keep this running
ollama serve

# Download the model (~9 GB)
ollama pull deepseek-r1:14b
```

Verify the server is up:
```bash
curl http://localhost:11434/api/tags
# Should show deepseek-r1:14b in the model list
```

### 2. Install Python dependencies

```bash
pip3 install gdm-concordia google-genai requests
```

### 3. Run simulations

All results for this project have already been generated and are included in `results/`. The commands below are provided for reproducibility.

**Symmetric runs** (same persona for both agents):
```bash
# All 5 configs, both solution concepts — ~2 hours
python3 main.py

# With Chain-of-Thought reasoning — ~5 hours
python3 main.py --cot

# Single config, quick test (~25 minutes)
python3 main.py --config v1_rational_eut --concept maxmin
```

**Cross-play runs** (different persona per agent):
```bash
# All 20 asymmetric matchups, both concepts — ~8–9 hours
python3 main.py --cross-play-asymmetric

# Same with Chain-of-Thought — ~20–25 hours
python3 main.py --cross-play-asymmetric --cot

# Single matchup (~25 minutes)
python3 main.py --config-a v1_rational_eut --config-b v4_irrational_hawkish
```

**Running unattended overnight:**
```bash
nohup bash -c '
  python3 main.py --cross-play-asymmetric && \
  python3 main.py --cross-play-asymmetric --cot
' > simulation_log.txt 2>&1 &

# Monitor progress in another terminal
python3 watch_progress.py
```

### Runtime estimates

| Command | Time |
|---------|------|
| `python3 main.py` | ~2 hours |
| `python3 main.py --cot` | ~5 hours |
| `python3 main.py --cross-play-asymmetric` | ~8–9 hours |
| `python3 main.py --cross-play-asymmetric --cot` | ~20–25 hours |
| Single matchup (`--config-a X --config-b Y`) | ~25 minutes |
| Single matchup with CoT | ~60–75 minutes |

Times are for deepseek-r1:14b on Apple Silicon (M-series Mac). Each LLM call takes ~30–60 seconds; the model needs ~9 GB of RAM.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Required for the Gemini backend (also read from `.env`) |
| `OLLAMA_MODEL` | Override the model (default: `deepseek-r1:14b`) |

### Troubleshooting

**Timeout errors:** The model takes ~30–60 seconds per call. The backend retries automatically up to 5 times. Make sure nothing else is using the GPU.

**"Model not found":** Run `ollama pull deepseek-r1:14b`.

**Want a smaller/faster model:** `OLLAMA_MODEL=llama3.2 python3 main.py`. Note that smaller models may not differentiate between personas meaningfully.

---

## Part 2 — Viewing Results in the React Dashboard

The dashboard visualises all simulation results without needing to re-run anything — the JSON data files are pre-loaded in `dashboard/public/data/`.

### 1. Install dependencies

```bash
cd dashboard
npm install
```

### 2. Start the dev server

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Dashboard pages

| Page | What it shows |
|------|---------------|
| **Symmetric Results** | Per-config analysis: subgame choice distributions, meta-game mode selection, Nash equilibrium alignment, Price of Aggression |
| **Cross-Play Matrix** | 5×5 heatmap of asymmetric matchups; click any cell to see that matchup's subgame and meta-game detail |
| **CoT Complexity** | Chain-of-Thought reasoning metrics: word count, opponent modelling, dominance recognition — compared across all personas |

### Updating data after new simulations

If you run new simulations, copy the updated results into the dashboard's data directory before restarting the dev server:

```bash
# From the repo root
./copy_results.sh

# Then restart
cd dashboard && npm run dev
```

The `copy_results.sh` script copies `results/*/simulation_results*.json` into `dashboard/public/data/` with the filenames the dashboard expects.

---

## Quick Reference

| Goal | Command |
|------|---------|
| Run all symmetric configs | `python3 main.py` |
| Run symmetric with CoT | `python3 main.py --cot` |
| Run all 20 cross-play matchups | `python3 main.py --cross-play-asymmetric` |
| Run all 25 matchups (with mirrors) | `python3 main.py --cross-play` |
| Run a single matchup | `python3 main.py --config-a X --config-b Y` |
| View the dashboard | `cd dashboard && npm run dev` |
| Update dashboard data | `./copy_results.sh` |
| Monitor a long run | `python3 watch_progress.py` |
| Analyse CoT traces | `python3 analyze_cot.py` |
