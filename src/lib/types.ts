import { AnglishSource, POS } from "./constants";

export type CompiledEntry = {
  pos: {
    [pos in POS]: CompiledPOS;
  };
  isAnglish: boolean;
};

export type CompiledPOS = {
  senses: WordnetSense[];
  pronunciation: { value: string; variety?: string }[];
  rhyme: string;
  forms: string[];
  sounds: Sound[];
  origins: string[]; // TODO: Move `origins` to root level?
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

export type AnglishEntry = {
  pos: {
    [pos in POS]?: {
      senses: {
        english: string;
        source: AnglishSource;
      }[];
      origins: string[];
    };
  };
  isAnglish: boolean;
};

export type AnglishEntries = {
  [id: string]: AnglishEntry;
};

export type MatchedSenses = Record<string, { pos: { [pos in POS]: string[] } }>;

export type SearchResult = {
  word: string;
  parts: POS[];
  isAnglish: boolean;
};

export type WordEntry = {
  word: string;
  forms: (string | never)[];
  origins: (string | never)[];
  rhyme: string;
  isAnglish: boolean;
  pos: Partial<
    Record<POS, { forms: string[]; gloss: string; sentence: string | null }[]>
  >;
};

export type WordSchema = {
  id: number;
  word: string;
  pos: POS;
  forms: (string | never)[];
  origins: (string | never)[];
  rhyme: string;
  is_anglish: boolean;
};

export type TranslationTerm = {
  normal: string;
  pos: POS;
  text: string;
  pre: string;
  post: string;
  synonyms: { word: string }[];
  isAnglish: boolean;
  willTranslate: boolean;
};
