/*
 * Use the null character `\x00` as a delimiter for sorting purposes.
 * Using a different delimiter, like '|', causes keys like 'tree|tree|n|en,an'
 * to be sorted after 'treehouse|treehouse|n|en,an', because '|' ranks lower than
 * the alphabetical characters.
 */
export const searchIndexDelimiter = String.fromCharCode(0);

export const Longhand: { [pos in POS]: { short: string; long: string } } = {
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

export enum Lang {
  English = 'en',
  Anglish = 'an',
}

export enum POS {
  Noun = 'n',
  Verb = 'v',
  Adjective = 'a',
  Adverb = 'r',
  Satellite = 's',
  Conjunction = 'c',
  Adposition = 'p',
  Other = 'x',
  Unknown = 'u',
}

export enum AnglishSource {
  Wiktionary,
  Hurlebatte,
  MootEnglish,
  MootAnglish,
}
