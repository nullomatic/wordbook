SELECT 
    word,
    ARRAY_AGG(pos) AS pos,
    CASE 
    WHEN is_anglish THEN ARRAY['en', 'an']
    ELSE ARRAY['en']
    END AS langs
FROM 
    word
GROUP BY 
    word, is_anglish;