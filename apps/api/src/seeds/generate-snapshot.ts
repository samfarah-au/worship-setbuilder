/**
 * Generates a DB snapshot from the current live database.
 * Run from the repo root: pnpm --filter ./apps/api snapshot
 *
 * Writes apps/api/src/seeds/snapshot.json — commit the result.
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { getSupabase } from '../services/supabase';

async function generate() {
  const db = getSupabase();

  console.log('Fetching songs...');
  const { data: songs, error: songsErr } = await db
    .from('songs')
    .select('id, title, artist, source_labels, album, released_at, ccli_number, spotify_track_id, pco_song_id, last_scheduled_at, is_retired, created_at, updated_at')
    .order('title');
  if (songsErr) throw new Error(`songs: ${songsErr.message}`);

  console.log('Fetching arrangements...');
  const { data: arrangements, error: arrsErr } = await db
    .from('arrangements')
    .select('id, song_id, name, source_label, key_signature, key_number, tempo_bpm, time_signature, energy_level, is_primary, created_at');
  if (arrsErr) throw new Error(`arrangements: ${arrsErr.message}`);

  console.log('Fetching song_metadata...');
  const { data: song_metadata, error: metaErr } = await db
    .from('song_metadata')
    .select('song_id, themes, theological_depth, style, is_hymn, lyric_snippet, data_source');
  if (metaErr) throw new Error(`song_metadata: ${metaErr.message}`);

  console.log('Fetching app_settings...');
  const { data: app_settings, error: settingsErr } = await db
    .from('app_settings')
    .select('key, values');
  if (settingsErr) throw new Error(`app_settings: ${settingsErr.message}`);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    songs:        songs        ?? [],
    arrangements: arrangements ?? [],
    song_metadata: song_metadata ?? [],
    app_settings: app_settings ?? [],
  };

  const outPath = path.resolve(__dirname, 'snapshot.json');
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

  console.log(`\nSnapshot written to ${outPath}`);
  console.log(`  ${snapshot.songs.length} songs`);
  console.log(`  ${snapshot.arrangements.length} arrangements`);
  console.log(`  ${snapshot.song_metadata.length} song_metadata rows`);
  console.log(`  ${snapshot.app_settings.length} app_settings rows`);
  console.log('\nCommit snapshot.json to save this state.');
}

generate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
