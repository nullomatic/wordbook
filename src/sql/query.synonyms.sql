WITH WordId AS (
    SELECT id
    FROM word
    WHERE word = %word
    AND pos = %pos
),
SensesIn AS (
    SELECT synset_id
    FROM sense
    WHERE word_id IN (SELECT id FROM WordId)
),
Synsets AS (
    SELECT id
    FROM synset
    WHERE id IN (SELECT synset_id FROM SensesIn)
),
SimilarSynsets AS (
    SELECT synset_id_2 AS id
    FROM synset_synset
    WHERE synset_id_1 IN (SELECT id FROM Synsets) AND relation = 'similar'
),
CombinedSynsets AS (
    SELECT id FROM Synsets
    UNION
    SELECT id FROM SimilarSynsets
),
SensesOut AS (
    SELECT word_id
    FROM sense
    WHERE synset_id IN (SELECT id FROM CombinedSynsets)
)
SELECT word, is_anglish
FROM word
WHERE word != %word
  AND id IN (SELECT word_id FROM SensesOut)
