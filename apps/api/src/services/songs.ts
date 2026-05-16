import { getSupabase } from './supabase';
import { searchTrack, getTrackMetadata } from './spotify';

export interface NewSong {
  title: string;
  artist: string;
  sourceLabel: string;
  spotifyTrackId: string;
  album?: string;
  releasedAt?: Date;
  ccliNumber?: string;
  // Arrangement fields (entered manually)
  keySignature?: string;
  keyNumber?: number;
  tempoBpm?: number;
  timeSignature?: string;
  energyLevel?: number;
  // Metadata fields
  themes?: string[];
  theologicalDepth?: number;
  style?: string;
  isHymn?: boolean;
  lyricSnippet?: string;
}

export async function addSong(song: NewSong) {
  // 1. Insert into songs table
  const { data: songRow, error: songError } = await getSupabase()
    .from('songs')
    .insert({
      title:            song.title,
      artist:           song.artist,
      source_label:     song.sourceLabel,
      album:            song.album,
      released_at:      song.releasedAt?.toISOString().split('T')[0],
      ccli_number:      song.ccliNumber,
      spotify_track_id: song.spotifyTrackId,
    })
    .select()
    .single();

  if (songError) throw new Error(`Song insert failed: ${songError.message}`);

  // 2. Insert primary arrangement (if musical data provided)
  if (song.keySignature && song.keyNumber !== undefined) {
    const { error: arrError } = await getSupabase()
      .from('arrangements')
      .insert({
        song_id:        songRow.id,
        key_signature:  song.keySignature,
        key_number:     song.keyNumber,
        tempo_bpm:      song.tempoBpm,
        time_signature: song.timeSignature ?? '4/4',
        energy_level:   song.energyLevel,
        is_primary:     true,
      });

    if (arrError) throw new Error(`Arrangement insert failed: ${arrError.message}`);
  }

  // 3. Insert metadata
  const { error: metaError } = await getSupabase()
    .from('song_metadata')
    .insert({
      song_id:            songRow.id,
      themes:             song.themes ?? [],
      theological_depth:  song.theologicalDepth,
      style:              song.style ?? 'modern',
      is_hymn:            song.isHymn ?? false,
      lyric_snippet:      song.lyricSnippet,
      data_source:        'manual',
    });

  if (metaError) throw new Error(`Metadata insert failed: ${metaError.message}`);

  return songRow;
}

// Search Spotify and enrich with metadata before adding
export async function findAndAddSong(
  title: string,
  artist: string,
  sourceLabel: string,
  overrides: Partial<NewSong> = {}
) {
  const results = await searchTrack(title, artist);
  if (!results.length) throw new Error(`No Spotify results for "${title}" by ${artist}`);

  // Prefer non-live studio version
  const canonical = results.find((r: any) => !r.isLive) ?? results[0];

  return addSong({
    title:          canonical.title,
    artist:         canonical.artist,
    sourceLabel,
    spotifyTrackId: canonical.spotifyTrackId,
    album:          canonical.album,
    releasedAt:     canonical.releasedAt,
    ...overrides,
  });
}