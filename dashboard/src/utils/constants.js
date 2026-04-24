export const CONFIGS = [
  { id: 'v1_rational_eut', name: 'Rational (EUT)', short: 'V1', color: '#334155', description: 'Perfectly rational expected utility maximizer — computes Nash equilibria, no biases' },
  { id: 'v2_bounded_satisficing', name: 'Bounded Satisficing', short: 'V2', color: '#64748b', description: 'Boundedly rational satisficer — sets "good enough" thresholds, uses heuristics' },
  { id: 'v3_bounded_prospect_theory', name: 'Prospect Theory', short: 'V3', color: '#92400e', description: 'Loss-averse prospect theory agent — losses loom 2× larger, reference-dependent' },
  { id: 'v4_irrational_hawkish', name: 'Hawkish', short: 'V4', color: '#991b1b', description: 'Aggressive overconfident agent — overestimates own success, prefers Attack' },
  { id: 'v5_irrational_retaliatory', name: 'Retaliatory', short: 'V5', color: '#4c1d95', description: 'Emotional punishment-seeking agent — retaliates against aggression, mirrors opponent' },
];

// Cross-play (asymmetric) matchup definitions — kept for backwards compat with older
// components. New code should use the unified `matchups` structure in dataLoader.
export const CROSSPLAY_MATCHUPS = (() => {
  const matchups = [];
  for (const a of CONFIGS) {
    for (const b of CONFIGS) {
      if (a.id === b.id) continue;
      matchups.push({
        id: `${a.id}_vs_${b.id}`,
        config_a: a.id,
        config_b: b.id,
        name: `${a.short} vs ${b.short}`,
        fullName: `${a.name} vs ${b.name}`,
        description: `Country A: ${a.name} | Country B: ${b.name}`,
      });
    }
  }
  return matchups;
})();

export function getConfigById(id) {
  return CONFIGS.find(c => c.id === id);
}

export const MODE_NAMES = { P: 'Private Actor', S: 'State Unit', C: 'Coalition' };
export const ACTION_NAMES = { R: 'Attack', Th: 'Threaten' };
export const MODES = ['P', 'S', 'C'];
export const SUBGAME_KEYS = ['PP', 'PS', 'PC', 'SP', 'SS', 'SC', 'CP', 'CS', 'CC'];

export const CONCEPTS = ['maxmin', 'minmax'];
export const CONCEPT_LABELS = { maxmin: 'Maxmin (Defensive)', minmax: 'Minmax (Aggressive)' };

// ------------------------------------------------------------------
// Glossary — used by Tooltip wrappers across every tab
// ------------------------------------------------------------------

export const MODE_TOOLTIPS = {
  P: 'Private Actor — lowest cost, highest success rate, low escalation/attribution risk, low threat credibility',
  S: 'State Unit — highest cost, lower success rate, highest escalation/attribution risk, highest threat credibility',
  C: 'Coalition — shared cost, moderate success, highest escalation risk, moderate attribution and credibility',
};

export const ACTION_TOOLTIPS = {
  R: 'Attack (R) — execute the cyber operation. Higher impact, carries escalation and attribution risks',
  Th: 'Threaten (Th) — threaten without executing. Lower risk, depends on threat credibility',
};

export const CONCEPT_TOOLTIPS = {
  maxmin: 'Maxmin (Defensive): maximize the worst-case payoff — "what can I guarantee regardless of opponent?"',
  minmax: 'Minmax (Aggressive): minimize opponent\'s best-case payoff — "how can I make things worst for them?"',
};

export const WORLD_STATE_TOOLTIPS = {
  'Mutual Deterrence': 'Both agents chose Threaten. Threats remain more valuable than attacks.',
  'Mutual Conflict': 'Both agents chose Attack. Diminished returns for further attacks.',
  'Asymmetric (A attacks, B threatens)': 'Country A attacks while B only threatens — attacks lose value, threats gain credibility.',
  'Asymmetric (B attacks, A threatens)': 'Country B attacks while A only threatens — attacks lose value, threats gain credibility.',
};

export const PRICE_OF_AGGRESSION_TOOLTIP =
  'λ = defensive payoff / aggressive payoff. λ > 1 means defensive posture dominates — aggression is costly.';

export const METRIC_TOOLTIPS = {
  avg_reasoning_length: 'Average word count per reasoning trace — longer traces suggest harder decisions',
  avg_opponent_modeling: 'How often the agent references the opponent — higher means deeper theory-of-mind',
  dominance_recognition_rate: 'Fraction of subgames where the agent identifies a strictly dominant strategy',
  avg_hedge_count: 'Uncertainty language (however, might, depends) — higher means more deliberation under uncertainty',
  avg_comparison_count: 'Explicit weighing of alternatives (better than, vs, prefer) — higher means more deliberation',
};

export const METRIC_LABELS = {
  avg_reasoning_length: 'Avg Reasoning Length',
  avg_opponent_modeling: 'Opponent Modeling',
  dominance_recognition_rate: 'Dominance Recognition',
  avg_hedge_count: 'Hedging',
  avg_comparison_count: 'Deliberation',
};

export function subgameTooltip(key) {
  const [a, b] = key;
  return `Country A plays ${MODE_NAMES[a]} · Country B plays ${MODE_NAMES[b]}`;
}
