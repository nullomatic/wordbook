WITH WordIds AS (
    SELECT id, word, pos
    FROM word
    WHERE word IN (<words>)
),
SensesIn AS (
    SELECT synset_id, word_id, word
    FROM sense
    JOIN WordIds wi ON sense.word_id = wi.id
),
SimilarSynsets AS (
    SELECT ss.synset_id_2 AS id, si.word
    FROM synset_synset ss
    JOIN SensesIn si ON ss.synset_id_1 = si.synset_id
    WHERE ss.relation = 'similar'
),
CombinedSynsets AS (
    SELECT synset_id AS id, word
    FROM SensesIn
    UNION
    SELECT id, word FROM SimilarSynsets
),
SensesOut AS (
    SELECT DISTINCT word_id, word
    FROM sense
    JOIN CombinedSynsets cs ON sense.synset_id = cs.id
),
SynonymWords AS (
    SELECT DISTINCT w.word AS synonym, w.pos, w.is_anglish, w.id, w.frequency, so.word AS source_word
    FROM word w
    JOIN SensesOut so ON w.id = so.word_id
)
SELECT sw.synonym, sw.pos, sw.is_anglish, sw.frequency, sw.source_word
FROM SynonymWords sw
