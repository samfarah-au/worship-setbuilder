import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { SEED_SONGS } from './songs.seed';
import { searchTrack } from '../services/spotify';
import { addSong } from '../services/songs';
import { getSupabase } from '../services/supabase';

async function songExists(spotifyTrackId: string): Promise<boolean> {
  const { data } = await getSupabase()
    .from('songs')
    .select('id')
    .eq('spotify_track_id', spotifyTrackId)
    .single();
  return !!data;
}

async function run() {
  console.log(`\nSeeding ${SEED_SONGS.length} songs...\n`);

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const seed of SEED_SONGS) {
    try {
      // Search Spotify for this song
      const results = await searchTrack(seed.searchTitle, seed.searchArtist);

      if (!results.length) {
        console.log(`✗ No Spotify results: ${seed.title}`);
        failed++;
        continue;
      }

      // Prefer non-live studio version
      const match = results.find((r: any) => !r.isLive) ?? results[0];

      // Skip if already in DB
      const exists = await songExists(match.spotifyTrackId);
      if (exists) {
        console.log(`⊘ Already exists: ${seed.title}`);
        skipped++;
        continue;
      }

      await addSong({
        title:            seed.title,
        artist:           seed.artist,
        sourceLabels:     seed.sourceLabels,
        spotifyTrackId:   match.spotifyTrackId,
        album:            match.album,
        releasedAt:       match.releasedAt,
        ccliNumber:       seed.ccliNumber,
        keySignature:     seed.keySignature,
        keyNumber:        seed.keyNumber,
        tempoBpm:         seed.tempoBpm,
        timeSignature:    seed.timeSignature,
        energyLevel:      seed.energyLevel,
        themes:           seed.themes,
        theologicalDepth: seed.theologicalDepth,
        style:            seed.style,
        isHymn:           seed.isHymn,
      });

      console.log(`✓ Added: ${seed.title} (${match.releasedAt?.getFullYear()})`);
      added++;

      // Small delay to avoid Spotify rate limiting
      await new Promise(r => setTimeout(r, 200));

    } catch (err: any) {
      console.log(`✗ Failed: ${seed.title} — ${err.message}`);
      failed++;
    }
  }

  // Manual adds for songs not found on Spotify
  const manualSongs = [
    {
      title: 'Christ Be All Around Me', artist: 'Passion', sourceLabels: ['Passion'],
      spotifyTrackId: 'manual-christ-be-all', keySignature: 'C', keyNumber: 0,
      tempoBpm: 72, timeSignature: '4/4', energyLevel: 2,
      themes: ['Jesus', 'surrender', 'worship', 'presence'], theologicalDepth: 2, style: 'modern' as const, isHymn: false,
    },
    {
      title: 'Never Stops', artist: 'Planetshakers', sourceLabels: ['Planet Shakers'],
      spotifyTrackId: 'manual-never-stops', keySignature: 'A', keyNumber: 9,
      tempoBpm: 140, timeSignature: '4/4', energyLevel: 5,
      themes: ['praise', 'worship', 'love', 'adoration'], theologicalDepth: 1, style: 'modern' as const, isHymn: false,
    },
    {
      title: 'Fill Me Up', artist: 'Planetshakers', sourceLabels: ['Planet Shakers'],
      spotifyTrackId: 'manual-fill-me-up', keySignature: 'G', keyNumber: 7,
      tempoBpm: 136, timeSignature: '4/4', energyLevel: 4,
      themes: ['Holy Spirit', 'revival', 'worship', 'surrender'], theologicalDepth: 1, style: 'modern' as const, isHymn: false,
    },
  ];

  for (const song of manualSongs) {
    const exists = await songExists(song.spotifyTrackId);
    if (exists) { console.log(`⊘ Already exists: ${song.title}`); skipped++; continue; }
    await addSong(song);
    console.log(`✓ Added (manual): ${song.title}`);
    added++;
  }

  console.log(`\n─────────────────────────────`);
  console.log(`✓ Added:   ${added}`);
  console.log(`⊘ Skipped: ${skipped}`);
  console.log(`✗ Failed:  ${failed}`);
  console.log(`─────────────────────────────\n`);
}

run().catch(console.error);