# The Wordbook

Introduction

## Notes on Open English WordNet YAML data

As always when delving into foreign code, I was confronted with a dearth of documentation in my quest to create a compendium of Anglish terms. Here are some notes I've gathered that I find helpful in understanding the structure of the data.

- This project uses data from the [Open English WordNet](https://github.com/globalwordnet/english-wordnet) repository.
- [The data](https://github.com/globalwordnet/english-wordnet/tree/main/src/yaml) is split into three filetypes, according to the following patterns: `entries-{pos}.yaml` for word entries, `{pos}.{category}.yaml` for synsets (grouped by category), and `frames.yaml` for syntactic templates.
- Sense IDs are encoded according to the Princeton WordNet [sense key encoding guidelines](https://wordnet.princeton.edu/documentation/senseidx5wn).
- Synsets have an 8-digit ID followed by their part of speech, like `XXXXXXXX-p`. According to the [Open English WordNet formatting guidelines](https://github.com/globalwordnet/english-wordnet/blob/main/FORMAT.md), novel synsets should start with a `2` and increase from there.
- The optional `form` key in some entries holds an array of irregular variations of the [lemma](<https://en.wikipedia.org/wiki/Lemma_(morphology)>). For example, the entry for `wolf` has a `form` key that contains `['wolves']`.

## Resources

[Princeton WordNet](https://wordnet.princeton.edu/) | [Global WordNet Formats](https://globalwordnet.github.io/schemas/)

## TODO

Top Priorities:

- Translator
- Editor
- Create SQL procedures

Other:

- add anglish versions of each page, with option to toggle english/anglish
- group definitions by similar semantic meaning, tie word origin to each
- backlink forms to point at original lemma
- remove parts of speech that have no senses
- remove words that have no parts of speech
- add fake/joke ads
- readme: add vocabulary section covering basic linguistic vocab, like "lemma", "sense", "hypernym", etc.
- readme: add links to similarity algorithms (Wu-Palmer, Leacock-Chodorow, Jiang-Conrath, Lin)

UI inspiration
https://reniki.com/blog/gradient-border
