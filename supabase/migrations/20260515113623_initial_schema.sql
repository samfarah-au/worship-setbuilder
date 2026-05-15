-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SONGS (core catalog)
-- ============================================================
CREATE TABLE songs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  artist            TEXT NOT NULL,
  source_label      TEXT NOT NULL,
  album             TEXT,
  released_at       DATE,
  released_year     INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM released_at)::INT) STORED,
  ccli_number       TEXT,
  spotify_track_id  TEXT UNIQUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ARRANGEMENTS (a song can exist in multiple keys)
-- ============================================================
CREATE TABLE arrangements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id               UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  key_signature         TEXT NOT NULL,
  key_number            INT NOT NULL CHECK (key_number BETWEEN 0 AND 11),
  tempo_bpm             INT CHECK (tempo_bpm BETWEEN 20 AND 300),
  time_signature        TEXT NOT NULL DEFAULT '4/4',
  energy_level          INT CHECK (energy_level BETWEEN 1 AND 5),
  is_primary            BOOLEAN DEFAULT TRUE,
  spotify_audio_features JSONB,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SONG METADATA (themes, theology, style)
-- ============================================================
CREATE TABLE song_metadata (
  song_id             UUID PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,
  themes              TEXT[] NOT NULL DEFAULT '{}',
  theological_depth   INT CHECK (theological_depth BETWEEN 1 AND 3),
  style               TEXT CHECK (style IN ('modern', 'hymn', 'gospel', 'folk-worship')),
  is_hymn             BOOLEAN DEFAULT FALSE,
  lyric_snippet       TEXT,
  data_source         TEXT DEFAULT 'manual'
);

-- ============================================================
-- CHURCH SONG LIBRARIES (imported from Planning Center)
-- ============================================================
CREATE TABLE church_songs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id             UUID NOT NULL,
  song_id               UUID REFERENCES songs(id),
  pco_song_id           TEXT,
  pco_arrangement_id    TEXT,
  last_used_at          DATE,
  use_count             INT DEFAULT 0,
  is_active             BOOLEAN DEFAULT TRUE,
  imported_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(church_id, pco_song_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_songs_released_year   ON songs(released_year);
CREATE INDEX idx_songs_released_at     ON songs(released_at);
CREATE INDEX idx_songs_source_label    ON songs(source_label);
CREATE INDEX idx_songs_ccli            ON songs(ccli_number);
CREATE INDEX idx_arrangements_song     ON arrangements(song_id);
CREATE INDEX idx_arrangements_key      ON arrangements(key_number);
CREATE INDEX idx_arrangements_bpm      ON arrangements(tempo_bpm);
CREATE INDEX idx_metadata_themes       ON song_metadata USING GIN(themes);
CREATE INDEX idx_church_songs_church   ON church_songs(church_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER songs_updated_at
  BEFORE UPDATE ON songs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();