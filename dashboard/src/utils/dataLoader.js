import { CONFIGS, CROSSPLAY_MATCHUPS, SUBGAME_KEYS } from './constants';

let dataCache = null;

export async function loadAllData() {
  if (dataCache) return dataCache;

  const results = {};
  const errors = [];

  for (const config of CONFIGS) {
    const [base, cot] = await Promise.all([
      fetch(`/data/${config.id}.json`)
        .then(r => { if (!r.ok) throw new Error(`${config.id}: ${r.status}`); return r.json() })
        .catch(err => { errors.push(err.message); return null }),
      fetch(`/data/${config.id}_cot.json`)
        .then(r => { if (!r.ok) throw new Error(`${config.id}_cot: ${r.status}`); return r.json() })
        .catch(() => null), // CoT files are optional
    ]);
    results[config.id] = { base, cot };
  }

  // Load cross-play (asymmetric matchup) data
  const crossplay = {};
  for (const matchup of CROSSPLAY_MATCHUPS) {
    const data = await fetch(`/data/crossplay/${matchup.id}.json`)
      .then(r => { if (!r.ok) throw new Error(`crossplay ${matchup.id}: ${r.status}`); return r.json() })
      .catch(() => null);
    if (data) {
      crossplay[matchup.id] = data;
    }
  }
  results.__crossplay = crossplay;

  if (Object.values(results).every(r => !r.base && !r.cot) && Object.keys(crossplay).length === 0) {
    throw new Error(`Failed to load any data. Errors: ${errors.join(', ')}`);
  }

  // Load CoT complexity analysis (optional)
  const cotAnalysis = await fetch('/data/cot_complexity_analysis.json')
    .then(r => { if (!r.ok) throw new Error(); return r.json() })
    .catch(() => null);

  results.__cotAnalysis = cotAnalysis;

  dataCache = results;
  return results;
}

export function getRunStats(data, concept) {
  const conceptData = data?.[concept];
  if (!conceptData?.runs?.length) return null;

  const runs = conceptData.runs;
  const payoffsA = runs.map(r => r.meta_game.payoff_a);
  const payoffsB = runs.map(r => r.meta_game.payoff_b);

  return {
    numRuns: runs.length,
    meanPayoffA: avg(payoffsA),
    meanPayoffB: avg(payoffsB),
    stdPayoffA: std(payoffsA),
    stdPayoffB: std(payoffsB),
    minPayoffA: Math.min(...payoffsA),
    maxPayoffA: Math.max(...payoffsA),
    minPayoffB: Math.min(...payoffsB),
    maxPayoffB: Math.max(...payoffsB),
  };
}

export function getActionDistribution(data, concept) {
  const runs = data?.[concept]?.runs;
  if (!runs?.length) return null;

  const dist = {};
  for (const key of SUBGAME_KEYS) {
    const aR = runs.filter(r => r.subgames[key].action_a === 'R').length;
    const bR = runs.filter(r => r.subgames[key].action_b === 'R').length;
    dist[key] = {
      a_attack: aR, a_threaten: runs.length - aR,
      b_attack: bR, b_threaten: runs.length - bR,
      total: runs.length,
    };
  }
  return dist;
}

export function getMetaModeDistribution(data, concept) {
  const runs = data?.[concept]?.runs;
  if (!runs?.length) return null;

  const distA = { P: 0, S: 0, C: 0 };
  const distB = { P: 0, S: 0, C: 0 };
  runs.forEach(r => {
    distA[r.meta_game.mode_a]++;
    distB[r.meta_game.mode_b]++;
  });
  return { a: distA, b: distB, total: runs.length };
}

export function getWorldStateDistribution(data, concept) {
  const runs = data?.[concept]?.runs;
  if (!runs?.length) return null;

  const dist = {};
  runs.forEach(r => {
    const ws = r.world_state;
    dist[ws] = (dist[ws] || 0) + 1;
  });
  return { distribution: dist, total: runs.length };
}

function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function std(arr) {
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}
