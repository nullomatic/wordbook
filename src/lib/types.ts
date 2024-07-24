export const Shorthand: { [_key in POS]: { short: string; long: string } } = {
  n: { short: 'noun', long: 'noun' },
  v: { short: 'verb', long: 'verb' },
  a: { short: 'adj', long: 'adjective' },
  r: { short: 'adv', long: 'adverb' },
  s: { short: 'sat', long: 'adjective satellite' },
  c: { short: 'conj', long: 'conjunction' },
  p: { short: 'prep', long: 'preposition' },
  x: { short: 'other', long: 'other' },
  u: { short: 'unk', long: 'unknown' },
};

export type Synset = {
  definition: string[];
  ili: string;
  members: string[];
  partOfSpeech: string;
  example?: string[];
  exemplifies?: string[];
  pertainym?: string[];
  derivation?: string[];
  event?: string[];
  antonym?: string[];
  state?: string[];
  agent?: string[];
  result?: string[];
  body_part?: string[];
  undergoer?: string[];
  also?: string[];
  property?: string[];
  location?: string[];
  by_means_of?: string[];
  instrument?: string[];
  uses?: string[];
  material?: string[];
  vehicle?: string[];
  participle?: string[];
  similar?: string[];
  destination?: string[];
  hypernym?: string[];
  attribute?: string[];
};

export type POS = 'n' | 'v' | 'a' | 'r' | 's' | 'c' | 'p' | 'x' | 'u';
export type Lang = 'en' | 'an';
