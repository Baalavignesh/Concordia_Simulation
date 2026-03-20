export const CONFIGS = [
  { id: 'v1_rational_eut', name: 'Rational (EUT)', short: 'V1', color: '#334155', description: 'Perfectly rational expected utility maximizer' },
  { id: 'v2_bounded_satisficing', name: 'Bounded Satisficing', short: 'V2', color: '#64748b', description: 'Boundedly rational satisficer' },
  { id: 'v3_bounded_prospect_theory', name: 'Prospect Theory', short: 'V3', color: '#92400e', description: 'Loss-averse prospect theory agent' },
  { id: 'v4_irrational_hawkish', name: 'Hawkish', short: 'V4', color: '#991b1b', description: 'Aggressive, overconfident agent' },
  { id: 'v5_irrational_retaliatory', name: 'Retaliatory', short: 'V5', color: '#4c1d95', description: 'Emotional, punishment-seeking agent' },
];

export const MODE_NAMES = { P: 'Private Actor', S: 'State Unit', C: 'Coalition' };
export const ACTION_NAMES = { R: 'Attack', Th: 'Threaten' };
export const MODES = ['P', 'S', 'C'];
export const SUBGAME_KEYS = ['PP', 'PS', 'PC', 'SP', 'SS', 'SC', 'CP', 'CS', 'CC'];

export const CONCEPTS = ['maxmin', 'minmax'];
export const CONCEPT_LABELS = { maxmin: 'Maxmin (Defensive)', minmax: 'Minmax (Aggressive)' };
