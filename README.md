# TODO

- integrate WordNet data, maybe also EuroWordNet
- highlight first search result / go to word page on Enter
- remove huge files from repo and host elsewhere
- add word page with meanings, definitions, and synonyms
- intersect wiktionary dataset with smaller dictionary
- add translator
- add "word of the day" widget
- add fake ads

1. Make definitive compendium of Anglish words (Moot + Wordbook)
2. Loop through words; if the word already exists in English, just add 'an' tag to WordNet data
3. Else, create a new entry and link to the correct synsets
4. Make Anglish example usages out of English

Holy shit this is way more complicated than I expected

The `entries` could have multiple senses, and the `wordnet` could have multiple senses.
I need to link up each sense to the appropriate synset, and remove the redundant ones.
