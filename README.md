# The Wordbook

Introduction

## Notes on Open English WordNet YAML data

As always when delving into foreign code, I was confronted with a dearth of documentation in my quest to create a compendium of Anglish terms. Here are some notes I've gathered that I find helpful in understanding the structure of the data.

- This project uses data from the [Open English WordNet repository](https://github.com/globalwordnet/english-wordnet).
- [The data](https://github.com/globalwordnet/english-wordnet/tree/main/src/yaml) is split into three filetypes, according to the following patterns: `entries-{pos}.yaml` for lexical (read: word) entries, `{pos}.{category}.yaml` for synsets, and `frames.yaml` for syntactic behavior templates.
- Sense IDs are encoded according to the [Princeton WordNet sense key encoding guidelines](https://wordnet.princeton.edu/documentation/senseidx5wn).
- Synsets have an 8-digit ID followed by their part of speech, like `XXXXXXXX-p`. According to the [Open English WordNet formatting guidelines](https://github.com/globalwordnet/english-wordnet/blob/main/FORMAT.md), novel synsets should start with a `2` and increase from there.
- Lexical entries have single-character part-of-speech keys that may have an additional `-1` or `-2` appended to indicate additional meanings for that part of speech. For this reason, the `pos` part of the composite `word + pos` composite key in the database is of type `VARCHAR(3)`.
- The optional `form` key in some entries holds an array of irregular variations of the [lemma](<https://en.wikipedia.org/wiki/Lemma_(morphology)>). For example, the entry for `wife` has a `form` key that contains `['wives']`.

## Resources

[Princeton WordNet](https://wordnet.princeton.edu/) | [Global WordNet Formats](https://globalwordnet.github.io/schemas/)

## TODO

- find words that have no senses/synset links, and link them
- refine origin strings
- create IDs for senses that have none

- integrate WordNet data, maybe also EuroWordNet
- highlight first search result / go to word page on Enter
- remove huge files from repo and host elsewhere
- add word page with meanings, definitions, and synonyms
- intersect wiktionary dataset with smaller dictionary
- add translator
- add "word of the day" widget
- add fake ads

UI inspiration
https://reniki.com/blog/gradient-border
