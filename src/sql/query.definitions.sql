WITH Entries AS (
    SELECT *
    FROM word
    WHERE word = %word
),
Senses AS (
    SELECT word_id, synset_id
    FROM sense
    WHERE word_id IN (SELECT id FROM Entries)
),
Synsets AS (
    SELECT id, def
    FROM synset
    WHERE id IN (SELECT synset_id FROM Senses)
),
Definitions AS (
    SELECT * FROM Entries en
    LEFT JOIN Senses se ON en.id = se.word_id
    LEFT JOIN Synsets sy ON se.synset_id = sy.id
)
SELECT word_id AS id,
       word,
       pos,
       forms,
       origin,
       rhymes,
       is_anglish,
       synset_id,
       def
FROM Definitions;