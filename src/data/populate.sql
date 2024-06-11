DROP TABLE IF EXISTS word, synset, word_synset;

/* Word */
CREATE TABLE word (
    word VARCHAR(50),
    pos VARCHAR(3),
    forms VARCHAR(50)[],
    is_anglish BOOLEAN NOT NULL,
    PRIMARY KEY (word, pos)
);
CREATE TABLE pronunciation (
    word VARCHAR(50),
    pos VARCHAR(3),
    variety CHAR(2),
    ipa VARCHAR(50),
    PRIMARY KEY (word, pos, variety)
);

/* Senses */
CREATE TABLE sense (
    id VARCHAR(65) PRIMARY KEY,
    word VARCHAR(50) REFERENCES word(word) ON UPDATE CASCADE ON DELETE CASCADE,
    synset CHAR(10) REFERENCES synset(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sentence TEXT,
    subcat VARCHAR(20)[]
);
/* sense-to-sense */
CREATE TABLE sense_exemplifies (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_derivation (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_pertainym (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_instrument (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_antonym (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_result (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_event (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_location (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_vehicle (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_agent (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_property (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_uses (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_undergoer (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_by_means_of (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_also (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_destination (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_material (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_state (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_body_part (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_participle (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);
CREATE TABLE sense_similar (
    sense_id_1 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sense_id_2 VARCHAR(65) REFERENCES sense(id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (sense_id_1, sense_id_2)
);

/* Synsets */
CREATE TABLE synset (
    id CHAR(10) PRIMARY KEY,
    definition VARCHAR(200),
    hypernym CHAR(10) REFERENCES synset(id),
    is_anglish BOOLEAN,
);