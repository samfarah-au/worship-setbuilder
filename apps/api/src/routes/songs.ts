import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabase';
import { scoreSongs, SongForScoring } from '../services/scoring';

const router = Router();

// GET /songs — list all songs with optional filters
router.get('/', async (req: Request, res: Response) => {
  const {
    source_label,
    since,
    until,
    within_years,
    style,
  } = req.query;

  let query = getSupabase()
    .from('songs')
    .select(`
      *,
      arrangements!inner(
        id, key_signature, key_number, tempo_bpm,
        time_signature, energy_level, is_primary
      ),
      song_metadata(
        themes, theological_depth, style, is_hymn
      )
    `)
    .eq('arrangements.is_primary', true);

  if (source_label) {
    const labels = (source_label as string).split(',');
    query = query.in('source_label', labels);
  }

  if (since) {
    query = query.gte('released_at', since as string);
  }

  if (until) {
    query = query.lte('released_at', until as string);
  }

  if (within_years) {
    const year = new Date().getFullYear() - parseInt(within_years as string);
    query = query.gte('released_year', year);
  }

  if (style) {
    query = query.eq('song_metadata.style', style as string);
  }

  const { data, error } = await query.order('title');

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// GET /songs/:id/suggestions — score all songs against this anchor
router.get('/:id/suggestions', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    source_label,
    since,
    within_years,
    limit = '10',
  } = req.query;

  // Fetch anchor song
  const { data: anchor, error: anchorError } = await getSupabase()
    .from('songs')
    .select(`
      *,
      arrangements!inner(
        key_signature, key_number, tempo_bpm,
        time_signature, energy_level, is_primary
      ),
      song_metadata(themes)
    `)
    .eq('id', id)
    .eq('arrangements.is_primary', true)
    .single();

  if (anchorError || !anchor) {
    return res.status(404).json({ error: 'Song not found' });
  }

  // Fetch candidates with same filters
  let query = getSupabase()
    .from('songs')
    .select(`
      *,
      arrangements!inner(
        key_signature, key_number, tempo_bpm,
        time_signature, energy_level, is_primary
      ),
      song_metadata(themes)
    `)
    .eq('arrangements.is_primary', true)
    .neq('id', id);

  if (source_label) {
    const labels = (source_label as string).split(',');
    query = query.in('source_label', labels);
  }

  if (since) {
    query = query.gte('released_at', since as string);
  }

  if (within_years) {
    const year = new Date().getFullYear() - parseInt(within_years as string);
    query = query.gte('released_year', year);
  }

  const { data: candidates, error: candidatesError } = await query;

  if (candidatesError) {
    return res.status(500).json({ error: candidatesError.message });
  }

  // Map to scoring format
  const toScoring = (song: any): SongForScoring => ({
    id:            song.id,
    title:         song.title,
    artist:        song.artist,
    keyNumber:     song.arrangements[0].key_number,
    keySignature:  song.arrangements[0].key_signature,
    tempoBpm:      song.arrangements[0].tempo_bpm,
    timeSignature: song.arrangements[0].time_signature,
    energyLevel:   song.arrangements[0].energy_level,
    themes:        song.song_metadata?.themes ?? [],
  });

  const anchorForScoring = toScoring(anchor);
  const candidatesForScoring = (candidates ?? []).map(toScoring);
  const results = scoreSongs(anchorForScoring, candidatesForScoring);

  return res.json({
    anchor: anchorForScoring,
    suggestions: results.slice(0, parseInt(limit as string)),
  });
});

export default router;