-- Migrate source_label (TEXT) → source_labels (TEXT[]) on songs
ALTER TABLE songs ADD COLUMN source_labels TEXT[] DEFAULT '{}';
UPDATE songs SET source_labels = ARRAY[source_label];
CREATE INDEX idx_songs_source_labels ON songs USING GIN(source_labels);
ALTER TABLE songs DROP COLUMN source_label;

-- Optional source label override per arrangement
ALTER TABLE arrangements ADD COLUMN source_label TEXT;

-- App-level settings (custom time signatures, styles)
CREATE TABLE app_settings (
  key    TEXT PRIMARY KEY,
  values TEXT[] NOT NULL DEFAULT '{}'
);
INSERT INTO app_settings (key, values) VALUES
  ('custom_time_signatures', '{}'),
  ('custom_styles', '{}');
