import { CONFIGS, SUBGAME_KEYS } from './constants';

let dataCache = null;

function fetchJson(url) {
  return fetch(url)
    .then(r => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); })
    .catch(() => null);
}

/**
 * Load all simulation data into a uniform 5x5 matchups structure.
 *
 * Returned shape:
 * {
 *   matchups: {
 *     [configA_id]: {
 *       [configB_id]: {
 *         standard: <simJson>|null,
 *         cot: <simJson>|null,
 *         isSymmetric: boolean,
 *         matchupId: string,     // `${a}_vs_${b}` for crossplay, or `${a}` for symmetric
 *         coverage: { standard, cot },
 *       }
 *     }
 *   },
 *   cotAnalysis: <cotComplexityJson>|null,
 *   coverage: { standard: {done, total}, cot: {done, total} }
 * }
 *
 * Every sim JSON retains its original keys (maxmin, minmax, price_of_aggression, etc.).
 * Diagonal cells (A===B) load from /data/<config>.json. Off-diagonal from
 * /data/crossplay/<a>_vs_<b>.json. CoT variants add `_cot` suffix.
 */
export async function loadAllData() {
  if (dataCache) return dataCache;

  const matchups = {};
  let stdDone = 0, cotDone = 0;
  const total = CONFIGS.length * CONFIGS.length;

  for (const a of CONFIGS) {
    matchups[a.id] = {};
    for (const b of CONFIGS) {
      const isSymmetric = a.id === b.id;
      let stdUrl, cotUrl, matchupId;

      if (isSymmetric) {
        stdUrl = `/data/${a.id}.json`;
        cotUrl = `/data/${a.id}_cot.json`;
        matchupId = a.id;
      } else {
        matchupId = `${a.id}_vs_${b.id}`;
        stdUrl = `/data/crossplay/${matchupId}.json`;
        cotUrl = `/data/crossplay/${matchupId}_cot.json`;
      }

      const [standard, cot] = await Promise.all([fetchJson(stdUrl), fetchJson(cotUrl)]);
      if (standard) stdDone++;
      if (cot) cotDone++;

      matchups[a.id][b.id] = {
        standard,
        cot,
        isSymmetric,
        matchupId,
        configA: a,
        configB: b,
        coverage: { standard: !!standard, cot: !!cot },
      };
    }
  }

  const cotAnalysis = await fetchJson('/data/cot_complexity_analysis.json');

  dataCache = {
    matchups,
    cotAnalysis,
    coverage: {
      standard: { done: stdDone, total },
      cot: { done: cotDone, total },
    },
  };
  return dataCache;
}

// ------------------------------------------------------------------
// Accessors — every view consumes matchup cells through these helpers.
// ------------------------------------------------------------------

export function getMatchup(data, configAId, configBId) {
  return data?.matchups?.[configAId]?.[configBId] || null;
}

/** Iterate all 25 cells as a flat array of { configA, configB, cell }. */
export function listMatchups(data) {
  const result = [];
  if (!data?.matchups) return result;
  for (const a of CONFIGS) {
    for (const b of CONFIGS) {
      const cell = data.matchups[a.id]?.[b.id];
      if (cell) result.push({ configA: a, configB: b, cell });
    }
  }
  return result;
}

/** Get the first run of a given (cell, source, concept). */
export function firstRun(cell, source, concept) {
  const sim = cell?.[source];
  return sim?.[concept]?.runs?.[0] || null;
}

/** Payoff/world-state summary for a cell at a given (source, concept). */
export function cellSummary(cell, source, concept) {
  const run = firstRun(cell, source, concept);
  if (!run) return null;
  return {
    payoffA: run.meta_game.payoff_a,
    payoffB: run.meta_game.payoff_b,
    modeA: run.meta_game.mode_a,
    modeB: run.meta_game.mode_b,
    worldState: run.world_state,
  };
}

/**
 * Decision divergence between standard and CoT for one cell and concept.
 * Returns null if either side is missing. Counts how many of the 20 decisions
 * (9 subgames × 2 players + 2 meta-game modes) differ.
 */
export function divergence(cell, concept) {
  const bRun = firstRun(cell, 'standard', concept);
  const cRun = firstRun(cell, 'cot', concept);
  if (!bRun || !cRun) return null;

  let different = 0;
  let total = 0;
  for (const key of SUBGAME_KEYS) {
    total += 2;
    if (bRun.subgames[key].action_a !== cRun.subgames[key].action_a) different++;
    if (bRun.subgames[key].action_b !== cRun.subgames[key].action_b) different++;
  }
  total += 2;
  if (bRun.meta_game.mode_a !== cRun.meta_game.mode_a) different++;
  if (bRun.meta_game.mode_b !== cRun.meta_game.mode_b) different++;

  return {
    different,
    total,
    rate: total > 0 ? +((different / total) * 100).toFixed(1) : 0,
  };
}

/** Aggregate world-state counts across all matchups at a given (source, concept). */
export function worldStateDistribution(data, source, concept) {
  const dist = {};
  let covered = 0;
  for (const { cell } of listMatchups(data)) {
    const run = firstRun(cell, source, concept);
    if (!run) continue;
    covered++;
    const ws = run.world_state;
    dist[ws] = (dist[ws] || 0) + 1;
  }
  return { dist, covered };
}

/** Aggregate mean payoffs across all matchups at a given (source, concept). */
export function aggregatePayoffs(data, source, concept) {
  const payoffsA = [];
  const payoffsB = [];
  for (const { cell } of listMatchups(data)) {
    const run = firstRun(cell, source, concept);
    if (!run) continue;
    payoffsA.push(run.meta_game.payoff_a);
    payoffsB.push(run.meta_game.payoff_b);
  }
  const avg = arr => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  return {
    meanA: avg(payoffsA),
    meanB: avg(payoffsB),
    n: payoffsA.length,
  };
}

/** Per-persona snapshot — treating each config as "Country A" across all its columns. */
export function personaSnapshot(data, configId, source, concept) {
  const row = data?.matchups?.[configId];
  if (!row) return null;
  const payoffs = [];
  const modeCounts = { P: 0, S: 0, C: 0 };
  const wsCounts = {};
  let covered = 0;
  for (const b of CONFIGS) {
    const cell = row[b.id];
    const run = firstRun(cell, source, concept);
    if (!run) continue;
    covered++;
    payoffs.push(run.meta_game.payoff_a);
    modeCounts[run.meta_game.mode_a]++;
    const ws = run.world_state;
    wsCounts[ws] = (wsCounts[ws] || 0) + 1;
  }
  const meanPayoff = payoffs.length
    ? payoffs.reduce((s, v) => s + v, 0) / payoffs.length
    : null;
  const topMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0];
  const topWs = Object.entries(wsCounts).sort((a, b) => b[1] - a[1])[0];
  return {
    meanPayoff,
    topMode: topMode?.[1] > 0 ? topMode[0] : null,
    topWorldState: topWs?.[0] || null,
    covered,
    total: CONFIGS.length,
  };
}
