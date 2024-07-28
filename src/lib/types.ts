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

export type CompiledEntry = {
  pos: {
    [pos in POS]: {
      senses: WordnetSense[];
      pronunciation?: { value: string; variety?: string }[];
      rhyme?: string;
      forms?: string[];
      sounds?: Sound[];
      origins?: string[]; // TODO: Move `origin` to root level.
    };
  };
  isAnglish: boolean;
};

export type WordnetEntry = {
  [pos in POS]: {
    sense: WordnetSense[];
    pronunciation?: { value: string; variety?: string }[];
    rhymes?: string;
    form?: string[];
    sounds?: Sound[];
  };
};

export type Sound = {
  ipa?: string;
  rhymes?: string;
  audio?: string;
  text?: string;
  tags?: string[];
  ogg_url?: string;
  mp3_url?: string;
  enpr?: string;
};

export type WordnetSense = {
  synset: string;
  id?: string;
  subcat?: string[];
  sent?: string[];
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
  destination?: string[];
};

export type WordnetSynset = {
  definition: string[];
  ili: string;
  members: string[];
  partOfSpeech: string;
  example?: string[];
  exemplifies?: string[];
  similar?: string[];
  hypernym?: string[];
  attribute?: string[];
};

export enum AnglishSource {
  Wiktionary,
  Hurlebatte,
  MootEnglish,
  MootAnglish,
}

export type AnglishEntry = {
  pos: {
    [pos in POS]?: {
      senses: {
        english: string;
        source: AnglishSource;
      }[];
      origins?: string[];
    };
  };
  isAnglish: boolean;
};

export type AnglishEntries = {
  [id: string]: AnglishEntry;
};

export type MatchedSenses = Record<string, { pos: { [pos in POS]: string[] } }>;
