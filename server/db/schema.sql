-- =============================================================================
-- Mergec Campus — Authoritative Database Schema (PostgreSQL / SQLite)
-- Regra i18n: Nomes e descrições armazenados em PT-BR no banco como referência
-- canônica, acompanhados de suas respectivas chaves/variáveis de tradução i18n.
-- =============================================================================

CREATE TABLE IF NOT EXISTS traits_catalog (
    trait_key       VARCHAR(64) PRIMARY KEY,
    trait_type      VARCHAR(16) NOT NULL CHECK (trait_type IN ('origin', 'class')),
    i18n_name_key   VARCHAR(128) NOT NULL UNIQUE,
    name_ptbr       VARCHAR(128) NOT NULL, -- Referência canônica em PT-BR
    i18n_desc_key   VARCHAR(128) NOT NULL,
    desc_ptbr       TEXT NOT NULL,         -- Texto base com variáveis {bonus}, {ap}, etc.
    thresholds_json VARCHAR(64) NOT NULL DEFAULT '[2, 4, 6]'
);

CREATE TABLE IF NOT EXISTS units_catalog (
    unit_id         VARCHAR(64) PRIMARY KEY,
    unit_key        VARCHAR(64) NOT NULL UNIQUE,
    category        VARCHAR(32) NOT NULL CHECK (category IN ('characters', 'monsters', 'npcs')),
    i18n_name_key   VARCHAR(128) NOT NULL UNIQUE,
    name_ptbr       VARCHAR(128) NOT NULL, -- Nome de referência em PT-BR no banco
    i18n_skill_key  VARCHAR(128) NOT NULL,
    skill_desc_ptbr TEXT NOT NULL,         -- Descrição em PT-BR com variáveis {damage}, {shield}, {heal}
    origin_key      VARCHAR(64) NOT NULL REFERENCES traits_catalog(trait_key),
    class_key       VARCHAR(64) NOT NULL REFERENCES traits_catalog(trait_key),
    cost            INTEGER NOT NULL CHECK (cost BETWEEN 1 AND 5),
    base_hp         INTEGER NOT NULL,
    max_mana        INTEGER NOT NULL DEFAULT 80,
    base_atk        INTEGER NOT NULL,
    base_def        INTEGER NOT NULL,
    atk_speed       NUMERIC(4,2) NOT NULL DEFAULT 0.80,
    attack_range    INTEGER NOT NULL DEFAULT 1,
    vfx_id          VARCHAR(32) NOT NULL DEFAULT '10008',
    directions_cnt  INTEGER NOT NULL DEFAULT 8 CHECK (directions_cnt = 8),
    actions_json    VARCHAR(64) NOT NULL DEFAULT '[0,1,2,3,7]',
    atlas_path      VARCHAR(255) NOT NULL,
    thumb_path      VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
    match_id        VARCHAR(64) PRIMARY KEY,
    player_id       VARCHAR(64) NOT NULL,
    round_num       INTEGER NOT NULL DEFAULT 1,
    phase           VARCHAR(16) NOT NULL DEFAULT 'prep',
    gold            INTEGER NOT NULL DEFAULT 16,
    player_level    INTEGER NOT NULL DEFAULT 3,
    xp              INTEGER NOT NULL DEFAULT 0,
    hp              INTEGER NOT NULL DEFAULT 100,
    streak          INTEGER NOT NULL DEFAULT 0,
    board_json      TEXT NOT NULL DEFAULT '[]',
    bench_json      TEXT NOT NULL DEFAULT '[]',
    shop_json       TEXT NOT NULL DEFAULT '[]',
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
