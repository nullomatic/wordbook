WITH WordEntries AS (
    SELECT *
    FROM word
    WHERE word = <word>
),
Senses AS (
    SELECT word_id, synset_id, sentence
    FROM sense
    WHERE word_id IN (SELECT id FROM WordEntries)
),
Synsets AS (
    SELECT id, gloss
    FROM synset
    WHERE id IN (SELECT synset_id FROM Senses)
),
Definitions AS (
    SELECT * FROM WordEntries en
    LEFT JOIN Senses se ON en.id = se.word_id
    LEFT JOIN Synsets sy ON se.synset_id = sy.id
)
SELECT word_id AS id,
       word,
       pos,
       forms,
       origins,
       rhyme,
       is_anglish,
       sentence,
       synset_id,
       gloss
FROM Definitions;