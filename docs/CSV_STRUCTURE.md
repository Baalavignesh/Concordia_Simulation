# Understanding the CSV Payoff Matrices

## File Naming Convention

Each CSV follows this pattern:

```
matrix_for_{Player}_{ModeA}{ModeB}.csv
```

- **Player**: `A` or `B` — whose payoffs this file contains
- **ModeA**: Country A's attack mode (`P`, `S`, or `C`)
- **ModeB**: Country B's attack mode (`P`, `S`, or `C`)

**Example:** `matrix_for_A_PC.csv` = Country A's payoffs when A uses **Private Actor** and B uses **Coalition**.

---

## Reading a CSV File

Take `matrix_for_A_PC.csv`:

```csv
"","V1","V2"
"1",0.705882352941177,0.705882352941177
"2",0.9,0.9
```

This is a **2×2 payoff matrix** laid out as:

```
                    B's action
                    ┌──────────┬──────────┐
                    │  Attack  │ Threaten │
                    │   (V1)   │   (V2)   │
        ┌───────────┼──────────┼──────────┤
  A's   │ Attack (1)│  0.7059  │  0.7059  │
 action │───────────┼──────────┼──────────┤
        │Threaten(2)│  0.9000  │  0.9000  │
        └───────────┴──────────┴──────────┘
```

| Part | Meaning |
|---|---|
| **V1** (column 1) | Opponent plays **Attack (R)** |
| **V2** (column 2) | Opponent plays **Threaten (Th)** |
| **Row "1"** | You play **Attack (R)** |
| **Row "2"** | You play **Threaten (Th)** |
| **The numbers** | Your payoff for that combination |
| **First column ("1", "2")** | Just a row index label — ignored by the code |

### Plain English Reading

From the example above (`matrix_for_A_PC.csv`):

- A attacks, B attacks → A gets **0.7059**
- A attacks, B threatens → A gets **0.7059**
- A threatens, B attacks → A gets **0.9**
- A threatens, B threatens → A gets **0.9**

> **Note:** When V1 = V2 in both rows (like above), it means the opponent's choice doesn't affect your payoff in this matchup. This isn't always the case.

---

## Why 18 CSVs Per Folder (Not 9)?

The game is **asymmetric** — Countries A and B have different capabilities, so the same situation produces **different payoffs** for each.

Example for the PP matchup (both using Private Actor):

| | A attacks, B attacks | A threatens, B threatens |
|---|---|---|
| **A's payoff** (`matrix_for_A_PP`) | 0.7059 | 0.9 |
| **B's payoff** (`matrix_for_B_PP`) | 0 | 0 |

A gets meaningful payoffs, B gets **zero**. Same game, completely different outcomes per player. That's why we need **2 files per cell** × **9 cells** = **18 CSVs**.

---

## The Two Folders: Maxmin vs Minmax

Both folders contain 18 CSVs with the same structure, but the payoff **values** differ because they represent two different strategic mindsets:

### Sim 1 - Maxmin (Defensive)

> *"What's the best I can guarantee, assuming my opponent tries to hurt me as much as possible?"*

- Pessimistic / worst-case thinking
- Values tend to be **moderate and safe** (e.g., 0.7059, 0.9)

### Sim1 - Minmax (Aggressive)

> *"How do I minimize my opponent's best possible outcome?"*

- Aggressive / offensive thinking
- Values tend to be **more extreme/negative** (e.g., -18.29, -8.91)
- Minmax files have a `_d` suffix (e.g., `matrix_for_A_PP_d.csv`)

### How the values were calculated

The payoff numbers are **pre-computed externally** (not by our code) using these formulas:

| Action | Formula | Variables |
|---|---|---|
| **Attack (R)** | `(v - c)(1 - β) / (1 - α)` | v = success rate, c = cost, β = attribution risk, α = escalation risk |
| **Threaten (Th)** | `(v - c)γ` | γ = threat credibility |

Different parameter values for each mode (P, S, C) and strategic philosophy (maxmin vs minmax) were plugged into these formulas to generate the CSV values.

Our simulation code **just loads these numbers** — it doesn't compute them.

---

## Complete File Listing

Each folder contains these 18 files:

```
matrix_for_A_PP    matrix_for_B_PP     ← Both use Private Actor
matrix_for_A_PS    matrix_for_B_PS     ← A=Private, B=State
matrix_for_A_PC    matrix_for_B_PC     ← A=Private, B=Coalition
matrix_for_A_SP    matrix_for_B_SP     ← A=State, B=Private
matrix_for_A_SS    matrix_for_B_SS     ← A=State, B=State
matrix_for_A_SC    matrix_for_B_SC     ← A=State, B=Coalition
matrix_for_A_CP    matrix_for_B_CP     ← A=Coalition, B=Private
matrix_for_A_CS    matrix_for_B_CS     ← A=Coalition, B=State
matrix_for_A_CC    matrix_for_B_CC     ← A=Coalition, B=Coalition
```
