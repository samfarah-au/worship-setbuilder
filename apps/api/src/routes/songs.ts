import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabase';
import { scoreSongs, SongForScoring } from '../services/scoring';

const router = Router();

const ARRANGEMENT_SELECT = 'id, name, source_label, key_signature, key_number, tempo_bpm, time_signature, energy_level, is_primary';

// GET /songs — list all songs with optional filters
router.get('/', async (req: Request, res: Response) => {
  const { source_labels, since, until, within_years, style } = req.query;

  let query = getSupabase()
    .from('songs')
    .select(`*, arrangements(${ARRANGEMENT_SELECT}), song_metadata(themes, theological_depth, style, is_hymn)`);

  if (source_labels) {
    const labels = (source_labels as string).split(',');
    query = query.overlaps('source_labels', labels);
  }
  if (since)        query = query.gte('released_at', since as string);
  if (until)        query = query.lte('released_at', until as string);
  if (within_years) query = query.gte('released_year', new Date().getFullYear() - parseInt(within_years as string));
  if (style)        query = query.eq('song_metadata.style', style as string);

  const { data, error } = await query.order('title');
  if (error) return res.status(500).json({ error: error.message });

  const sorted = (data ?? []).map((song: any) => ({
    ...song,
    arrangements: [
      ...(song.arrangements ?? []).filter((a: any) => a.is_primary),
      ...(song.arrangements ?? []).filter((a: any) => !a.is_primary),
    ],
  }));

  return res.json(sorted);
});

// PATCH /songs/:id — update song-level fields, primary arrangement, and metadata
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    source_labels,
    name, key_signature, key_number, tempo_bpm, time_signature, energy_level,
    themes, theological_depth, style, is_hymn,
  } = req.body;

  const supabase = getSupabase();

  // Update songs table
  if (source_labels !== undefined) {
    const { error } = await supabase.from('songs').update({ source_labels }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
  }

  // Update primary arrangement
  const arrangementFields: Record<string, unknown> = {};
  if (name           !== undefined) arrangementFields.name           = name;
  if (key_signature  !== undefined) arrangementFields.key_signature  = key_signature;
  if (key_number     !== undefined) arrangementFields.key_number     = key_number;
  if (tempo_bpm      !== undefined) arrangementFields.tempo_bpm      = tempo_bpm;
  if (time_signature !== undefined) arrangementFields.time_signature = time_signature;
  if (energy_level   !== undefined) arrangementFields.energy_level   = energy_level;

  if (Object.keys(arrangementFields).length > 0) {
    const { error } = await supabase.from('arrangements').update(arrangementFields).eq('song_id', id).eq('is_primary', true);
    if (error) return res.status(500).json({ error: error.message });
  }

  // Update metadata
  const metaFields: Record<string, unknown> = {};
  if (themes            !== undefined) metaFields.themes            = themes;
  if (theological_depth !== undefined) metaFields.theological_depth = theological_depth;
  if (style             !== undefined) metaFields.style             = style;
  if (is_hymn           !== undefined) metaFields.is_hymn           = is_hymn;

  if (Object.keys(metaFields).length > 0) {
    const { error } = await supabase.from('song_metadata').update(metaFields).eq('song_id', id);
    if (error) return res.status(500).json({ error: error.message });
  }

  const { data, error } = await supabase
    .from('songs')
    .select(`*, arrangements(${ARRANGEMENT_SELECT}), song_metadata(themes, theological_depth, style, is_hymn)`)
    .eq('id', id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// POST /songs/:id/arrangements — add an alternate arrangement
router.post('/:id/arrangements', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, source_label, key_signature, key_number, tempo_bpm, time_signature, energy_level } = req.body;

  if (!key_signature || key_number === undefined || !tempo_bpm || !time_signature || !energy_level) {
    return res.status(400).json({ error: 'key_signature, key_number, tempo_bpm, time_signature, energy_level are required' });
  }

  const { data, error } = await getSupabase()
    .from('arrangements')
    .insert({ song_id: id, name: name ?? null, source_label: source_label ?? null, key_signature, key_number, tempo_bpm, time_signature, energy_level, is_primary: false })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json(data);
});

// DELETE /arrangements/:arrangementId — remove an alternate arrangement
router.delete('/arrangements/:arrangementId', async (req: Request, res: Response) => {
  const { arrangementId } = req.params;

  const { data: arr, error: fetchErr } = await getSupabase().from('arrangements').select('is_primary').eq('id', arrangementId).single();
  if (fetchErr || !arr) return res.status(404).json({ error: 'Arrangement not found' });
  if (arr.is_primary)   return res.status(400).json({ error: 'Cannot delete primary arrangement' });

  const { error } = await getSupabase().from('arrangements').delete().eq('id', arrangementId);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
});

// GET /songs/:id/suggestions — score all arrangements per candidate, return best
router.get('/:id/suggestions', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { source_labels, since, within_years, limit = '10' } = req.query;

  const { data: anchor, error: anchorError } = await getSupabase()
    .from('songs')
    .select(`*, arrangements!inner(key_signature, key_number, tempo_bpm, time_signature, energy_level, is_primary), song_metadata(themes)`)
    .eq('id', id).eq('arrangements.is_primary', true).single();

  if (anchorError || !anchor) return res.status(404).json({ error: 'Song not found' });

  let query = getSupabase()
    .from('songs')
    .select(`*, arrangements(${ARRANGEMENT_SELECT}), song_metadata(themes)`)
    .neq('id', id);

  if (source_labels) query = query.overlaps('source_labels', (source_labels as string).split(','));
  if (since)         query = query.gte('released_at', since as string);
  if (within_years)  query = query.gte('released_year', new Date().getFullYear() - parseInt(within_years as string));

  const { data: candidates, error: candidatesError } = await query;
  if (candidatesError) return res.status(500).json({ error: candidatesError.message });

  const anchorForScoring: SongForScoring = {
    id: anchor.id, title: anchor.title, artist: anchor.artist,
    keyNumber: anchor.arrangements[0].key_number, keySignature: anchor.arrangements[0].key_signature,
    tempoBpm: anchor.arrangements[0].tempo_bpm, timeSignature: anchor.arrangements[0].time_signature,
    energyLevel: anchor.arrangements[0].energy_level, themes: anchor.song_metadata?.themes ?? [],
  };

  type CandidateWithMeta = { scoringObj: SongForScoring; isPrimary: boolean; primaryKeySignature: string };

  const candidatesWithMeta: CandidateWithMeta[] = (candidates ?? [])
    .map((song: any) => {
      const arrangements: any[] = song.arrangements ?? [];
      if (!arrangements.length) return null;
      const themes: string[] = song.song_metadata?.themes ?? [];
      const primaryArr = arrangements.find((a: any) => a.is_primary) ?? arrangements[0];
      let bestArr = arrangements[0], bestScore = -1;
      for (const arr of arrangements) {
        const [result] = scoreSongs(anchorForScoring, [{
          id: song.id, title: song.title, artist: song.artist,
          keyNumber: arr.key_number, keySignature: arr.key_signature,
          tempoBpm: arr.tempo_bpm, timeSignature: arr.time_signature,
          energyLevel: arr.energy_level, themes,
        }]);
        if (result && result.total > bestScore) { bestScore = result.total; bestArr = arr; }
      }
      return {
        scoringObj: { id: song.id, title: song.title, artist: song.artist, keyNumber: bestArr.key_number, keySignature: bestArr.key_signature, tempoBpm: bestArr.tempo_bpm, timeSignature: bestArr.time_signature, energyLevel: bestArr.energy_level, themes } as SongForScoring,
        isPrimary: bestArr.is_primary,
        primaryKeySignature: primaryArr.key_signature,
      };
    })
    .filter((c): c is CandidateWithMeta => c !== null);

  const results = scoreSongs(anchorForScoring, candidatesWithMeta.map(c => c.scoringObj));
  const enriched = results.map(result => {
    const meta = candidatesWithMeta.find(c => c.scoringObj.id === result.song.id);
    if (meta && !meta.isPrimary) {
      return { ...result, reasons: [...result.reasons, `Alternate key shown (${result.song.keySignature}) — primary is ${meta.primaryKeySignature}`] };
    }
    return result;
  });

  return res.json({ anchor: anchorForScoring, suggestions: enriched.slice(0, parseInt(limit as string)) });
});

export default router;
