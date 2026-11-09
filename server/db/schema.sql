-- =============================================================================
-- Mergec Campus — Complete Authoritative Database Schema (PostgreSQL 16)
-- Supports full CRUD for Economy, Combat/Damage Formulas, Units, Skills,
-- Special Effects (VFX), Synergies (Traits), and i18n Translations.
-- =============================================================================

CREATE TABLE IF NOT EXISTS game_config (
    config_id                   INTEGER PRIMARY KEY DEFAULT 1 CHECK (config_id = 1),
    -- Economia & Loja
    starting_gold               INTEGER NOT NULL DEFAULT 16,
    reroll_cost                 INTEGER NOT NULL DEFAULT 2,
    xp_buy_cost                 INTEGER NOT NULL DEFAULT 4,
    xp_buy_amount               INTEGER NOT NULL DEFAULT 4,
    round_win_gold              INTEGER NOT NULL DEFAULT 5,
    round_loss_gold             INTEGER NOT NULL DEFAULT 4,
    interest_per_10_gold        INTEGER NOT NULL DEFAULT 1,
    max_interest_gold           INTEGER NOT NULL DEFAULT 5,
    streak_threshold            INTEGER NOT NULL DEFAULT 3,
    streak_bonus_gold           INTEGER NOT NULL DEFAULT 2,
    starting_player_hp          INTEGER NOT NULL DEFAULT 100,
    starting_level              INTEGER NOT NULL DEFAULT 3,
    max_level                   INTEGER NOT NULL DEFAULT 9,
    -- Fórmulas de Merge (Estrelas)
    star2_multiplier            NUMERIC(5,2) NOT NULL DEFAULT 1.80,
    star3_multiplier            NUMERIC(5,2) NOT NULL DEFAULT 3.24,
    star_def_scale              NUMERIC(5,2) NOT NULL DEFAULT 0.35,
    -- Fórmulas de Cálculo de Dano, Mana & Habilidades
    mana_per_attack             INTEGER NOT NULL DEFAULT 15,
    mana_on_hit_taken           INTEGER NOT NULL DEFAULT 6,
    armor_mitigation_k          NUMERIC(6,2) NOT NULL DEFAULT 100.00,
    skill_armor_pen_factor      NUMERIC(4,2) NOT NULL DEFAULT 0.60,
    min_basic_damage            INTEGER NOT NULL DEFAULT 12,
    min_skill_damage            INTEGER NOT NULL DEFAULT 35,
    skill_shield_ratio          NUMERIC(4,2) NOT NULL DEFAULT 0.40,
    nature_heal_interval_sec    NUMERIC(4,2) NOT NULL DEFAULT 2.00,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO game_config (config_id) VALUES (1) ON CONFLICT (config_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS traits_catalog (
    trait_key       VARCHAR(64) PRIMARY KEY,
    trait_type      VARCHAR(16) NOT NULL CHECK (trait_type IN ('origin', 'class')),
    icon            VARCHAR(16) NOT NULL DEFAULT '✨',
    i18n_name_key   VARCHAR(128) NOT NULL,
    name_ptbr       VARCHAR(128) NOT NULL,
    i18n_desc_key   VARCHAR(128) NOT NULL,
    desc_ptbr       TEXT NOT NULL,
    thresholds_json TEXT NOT NULL DEFAULT '[2, 4, 6]',
    bonuses_json    TEXT NOT NULL DEFAULT '{"2":{"bonus":20},"4":{"bonus":45},"6":{"bonus":80}}'
);

CREATE TABLE IF NOT EXISTS vfx_catalog (
    vfx_id          VARCHAR(32) PRIMARY KEY,
    name_ptbr       VARCHAR(128) NOT NULL,
    frame_duration  NUMERIC(5,3) NOT NULL DEFAULT 0.055,
    default_scale   NUMERIC(4,2) NOT NULL DEFAULT 1.15,
    blend_mode      VARCHAR(16) NOT NULL DEFAULT 'ADD',
    atlas_path      VARCHAR(255) NOT NULL,
    thumb_path      VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS units_catalog (
    unit_id           VARCHAR(64) PRIMARY KEY,
    unit_key          VARCHAR(64) NOT NULL UNIQUE,
    category          VARCHAR(32) NOT NULL CHECK (category IN ('characters', 'monsters', 'npcs')),
    i18n_name_key     VARCHAR(128) NOT NULL,
    name_ptbr         VARCHAR(128) NOT NULL,
    i18n_skill_key    VARCHAR(128) NOT NULL,
    skill_desc_ptbr   TEXT NOT NULL,
    origin_key        VARCHAR(64) NOT NULL,
    class_key         VARCHAR(64) NOT NULL,
    cost              INTEGER NOT NULL CHECK (cost BETWEEN 1 AND 5),
    is_featured_pool  BOOLEAN NOT NULL DEFAULT false,
    base_hp           INTEGER NOT NULL DEFAULT 600,
    max_mana          INTEGER NOT NULL DEFAULT 80,
    start_mana        INTEGER NOT NULL DEFAULT 20,
    base_atk          INTEGER NOT NULL DEFAULT 50,
    base_def          INTEGER NOT NULL DEFAULT 25,
    atk_speed         NUMERIC(4,2) NOT NULL DEFAULT 0.80,
    attack_range      INTEGER NOT NULL DEFAULT 1,
    skill_damage      INTEGER NOT NULL DEFAULT 250,
    skill_shield      INTEGER NOT NULL DEFAULT 150,
    skill_heal        INTEGER NOT NULL DEFAULT 150,
    vfx_id            VARCHAR(32) NOT NULL DEFAULT '10008',
    skill_icon        VARCHAR(255) NOT NULL DEFAULT 'assets/skills/icons/skill_normal_000001.png',
    directions_cnt    INTEGER NOT NULL DEFAULT 8,
    actions_json      VARCHAR(64) NOT NULL DEFAULT '[0,1,2,3,7]',
    atlas_path        VARCHAR(255) NOT NULL,
    thumb_path        VARCHAR(255) NOT NULL,
    anchor_json       VARCHAR(64) NOT NULL DEFAULT '[0.5, 0.9]',
    feet_y            INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS i18n_translations (
    i18n_key        VARCHAR(128) NOT NULL,
    locale          VARCHAR(16) NOT NULL,
    text_value      TEXT NOT NULL,
    ptbr_reference  TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (i18n_key, locale)
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
