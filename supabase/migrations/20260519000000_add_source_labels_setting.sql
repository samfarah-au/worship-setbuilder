INSERT INTO app_settings (key, values) VALUES ('custom_source_labels', '{}') ON CONFLICT (key) DO NOTHING;
