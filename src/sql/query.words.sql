SELECT
  word.*,
  CASE
    WHEN COUNT(sense.id) = 0 THEN NULL
    ELSE ARRAY_AGG (sense.id)
  END AS sense_ids
FROM
  word
  LEFT JOIN sense ON word.id = sense.word_id
WHERE
  word.word LIKE <word>
GROUP BY
  word.id
ORDER BY
  word.word
LIMIT
  30
OFFSET <offset>
