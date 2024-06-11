CREATE TABLE word (
    word VARCHAR(100) NOT NULL,
    pos CHAR() NOT NULL,
    pronunciation VARCHAR(100),
    is_anglish BOOLEAN,
    PRIMARY KEY (word, pos)
)

CREATE TABLE sense (
    id SERIAL PRIMARY KEY,
    def TEXT NOT NULL,
    hypernym INT REFERENCES sense(id),
    ili CHAR(10)
)

CREATE TABLE word_sense (
    word VARCHAR(100) NOT NULL,
    pos CHAR() NOT NULL,
    sense_id INT NOT NULL,
    PRIMARY KEY (word, pos, sense_id),
    CONSTRAINT fk_word FOREIGN KEY (word, pos) REFERENCES word(word, pos),
    CONSTRAINT fk_sense FOREIGN KEY (sense_id) REFERENCES sense(id)
)

INSERT into word VALUES ('grammar', 'n', 'ˈɡɹæ.mɚ', true)
INSERT into sense VALUES ('06184139-n', 'the branch of linguistics that deals with syntax and morphology', null)
INSERT into word_sense VALUES ('grammar', 'n', '06184139-n')

/* Get all parts of speech and senses for 'grammar' */
SELECT word.*, sense.* FROM word WHERE (word.word = 'grammar')
JOIN word_sense ws ON (ws.word = word.word AND ws.pos = word.pos)
JOIN sense ON (sense.id = ws.sense_id)

/* Get all senses for 'grammar:n' */
SELECT word.*, sense.* FROM word WHERE (word.word = 'grammar' AND word.pos = 'n')
JOIN word_sense ws ON (ws.word = word.word AND ws.pos = word.pos)
JOIN sense ON (sense.id = ws.sense_id)

/* Get all synonyms of 'grammar:n' */
WITH synonyms AS (
    SELECT DISTINCT sense_id
    FROM word_sense WHERE (word.word = 'grammar' AND word.pos = 'n')
    UNION
    SELECT id
    FROM sense WHERE sense.hypernym = 
)
SELECT word.*
FROM word_sense WHERE (sense_id IN synonyms AND word_sense.word <> 'grammar')
JOIN word WHERE (word.word = word_sense.word AND word.pos = word_sense.pos)

word
- grammar:n
- other:n

word_sense
- grammar:n:sense1
- grammar:n:sense2
- foo:n:sense1
- bar:n:sense2
- baz:a:sense3

sense
- sense1
- sense2
