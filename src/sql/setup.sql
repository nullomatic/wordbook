DROP TABLE IF EXISTS
    word,
    synset,
    sense,
    frame,
    word_sense,
    sense_sense,
    sense_frame,
    synset_synset;

/* Word */
CREATE TABLE word (
    id SERIAL PRIMARY KEY,
    word VARCHAR(80) NOT NULL,
    pos VARCHAR(3) NOT NULL,
    forms VARCHAR(80)[],
    origins TEXT[],
    rhyme VARCHAR(80),
    is_anglish BOOLEAN NOT NULL
);

/* Synset */
CREATE TABLE synset (
    id CHAR(10) PRIMARY KEY,
    pos VARCHAR(3) NOT NULL,
    gloss TEXT
);

/* Sense */
CREATE TABLE sense (
    id SERIAL PRIMARY KEY,
    word_id INTEGER REFERENCES word(id) ON UPDATE CASCADE ON DELETE CASCADE,
    synset_id CHAR(10) REFERENCES synset(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sentence TEXT
);

/* Frame */
CREATE TABLE frame (
    id VARCHAR(20) PRIMARY KEY,
    template VARCHAR(80)
);

/* Sense-Sense */
CREATE TABLE sense_sense (
    sense_id_1 INTEGER REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 INTEGER REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    relation VARCHAR(20),
    PRIMARY KEY (sense_id_1, sense_id_2, relation)
);

/* Sense-Frame */
CREATE TABLE sense_frame (
    sense_id INTEGER REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    frame_id VARCHAR(20) REFERENCES frame(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id, frame_id)
);

/* Synset-Synset */
CREATE TABLE synset_synset (
    synset_id_1 CHAR(10) REFERENCES synset(id) ON UPDATE CASCADE ON DELETE CASCADE,
    synset_id_2 CHAR(10) REFERENCES synset(id) ON UPDATE CASCADE ON DELETE CASCADE,
    relation VARCHAR(20),
    PRIMARY KEY (synset_id_1, synset_id_2, relation)
);