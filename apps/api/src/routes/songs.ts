import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabase';
import { scoreSongs, SongForScoring } from '../services/scoring';
import { searchTrack } from '../services/spotify';
import { addSong } from '../services/songs';

const router = Router();

const ARRANGEMENT_SELECT = 'id, name, source_label, key_signature, key_number, tempo_bpm, time_signature, energy_level, is_primary';

// GET /songs/search?title=X&artist=Y — search Spotify for candidates
router.get('/search', async (req: Request, res: Response) => {
  const { title, artist } = req.query;
  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const results = await searchTrack(title as string, (artist as string) ?? '');
    return res.json(results);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /songs — create a new song (with optional Spotify-enriched fields)
router.post('/', async (req: Request, res: Response) => {
  const {
    title, artist, source_labels, spotify_track_id,
    album, released_at, ccli_number,
    key_signature, key_number, tempo_bpm, time_signature, energy_level,
    themes, theological_depth, style, is_hymn,
  } = req.body;

  if (!title || !artist || !source_labels?.length) {
    return res.status(400).json({ error: 'title, artist, and source_labels are required' });
  }

  // Guard against duplicates by spotify_track_id
  if (spotify_track_id) {
    const { data: existing } = await getSupabase()
      .from('songs')
      .select('id, title')
      .eq('spotify_track_id', spotify_track_id)
      .maybeSingle();
    if (existing) return res.status(409).json({ error: `Already in library as "${existing.title}"`, existing });
  }

  try {
    const songRow = await addSong({
      title, artist,
      sourceLabels:    source_labels,
      spotifyTrackId:  spotify_track_id ?? undefined,
      album:           album ?? undefined,
      releasedAt:      released_at ? new Date(released_at) : undefined,
      ccliNumber:      ccli_number ?? undefined,
      keySignature:    key_signature ?? undefined,
      keyNumber:       key_number ?? undefined,
      tempoBpm:        tempo_bpm ?? undefined,
      timeSignature:   time_signature ?? undefined,
      energyLevel:     energy_level ?? undefined,
      themes:          themes ?? [],
      theologicalDepth: theological_depth ?? 2,
      style:           style ?? 'modern',
      isHymn:          is_hymn ?? false,
    });

    // Return full song shape matching GET /songs
    const { data, error } = await getSupabase()
      .from('songs')
      .select(`*, arrangements(${ARRANGEMENT_SELECT}), song_metadata(themes, theological_depth, style, is_hymn)`)
      .eq('id', songRow.id)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /songs — list all songs with optional filters
router.get('/', async (req: Request, res: Response) => {
  const { source_labels, since, until, within_years, style, pco_only, exclude_unlabeled, include_retired } = req.query;

  let query = getSupabase()
    .from('songs')
    .select(`*, arrangements(${ARRANGEMENT_SELECT}), song_metadata(themes, theological_depth, style, is_hymn)`);

  if (include_retired !== 'true') query = query.eq('is_retired', false);

  if (source_labels) {
    const labels = (source_labels as string).split(',');
    if (exclude_unlabeled === 'true') {
      query = query.overlaps('source_labels', labels);
    } else {
      // Include matching songs OR songs with no label at all
      const quotedLabels = labels.map(l => `"${l}"`).join(',');
      query = query.or(`source_labels.ov.{${quotedLabels}},source_labels.eq.{}`);
    }
  } else if (exclude_unlabeled === 'true') {
    query = query.not('source_labels', 'eq', '{}');
  }
  if (since)        query = query.gte('released_at', since as string);
  if (until)        query = query.lte('released_at', until as string);
  if (within_years) query = query.gte('released_year', new Date().getFullYear() - parseInt(within_years as string));
  if (style)        query = query.eq('song_metadata.style', style as string);
  if (pco_only === 'true') query = query.not('pco_song_id', 'is', null);

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

// POST /songs/bulk-label — add a source label to multiple songs
router.post('/bulk-label', async (req: Request, res: Response) => {
  const { ids, label } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }
  const lbl = (label as string)?.trim();
  if (!lbl) return res.status(400).json({ error: 'label is required' });

  const { data: songs, error } = await getSupabase()
    .from('songs').select('id, source_labels').in('id', ids);
  if (error) return res.status(500).json({ error: error.message });

  const toUpdate = (songs ?? []).filter((s: any) => !s.source_labels.includes(lbl));
  for (const song of toUpdate) {
    await getSupabase().from('songs')
      .update({ source_labels: [...song.source_labels, lbl] }).eq('id', song.id);
  }
  return res.json({ updated: toUpdate.length, total: ids.length });
});

// PATCH /songs/labels/rename — rename a source label across all songs
router.patch('/labels/rename', async (req: Request, res: Response) => {
  const { from, to } = req.body;
  const f = from?.trim(), t = to?.trim();
  if (!f || !t) return res.status(400).json({ error: 'from and to are required' });
  if (f === t)  return res.status(400).json({ error: 'Labels are the same' });

  const { data: toUpdate, error } = await getSupabase()
    .from('songs').select('id, source_labels').contains('source_labels', [f]);
  if (error) return res.status(500).json({ error: error.message });
  if (!toUpdate?.length) return res.json({ updated: 0 });

  for (const song of toUpdate) {
    await getSupabase().from('songs')
      .update({ source_labels: song.source_labels.map((l: string) => l === f ? t : l) })
      .eq('id', song.id);
  }
  return res.json({ updated: toUpdate.length });
});

// PATCH /songs/:id — update song-level fields, primary arrangement, and metadata
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    title, artist, source_labels, is_retired, spotify_track_id,
    name, key_signature, key_number, tempo_bpm, time_signature, energy_level,
    themes, theological_depth, style, is_hymn,
  } = req.body;

  const supabase = getSupabase();

  // Update songs table
  const songFields: Record<string, unknown> = {};
  if (title             !== undefined) songFields.title             = title;
  if (artist            !== undefined) songFields.artist            = artist;
  if (source_labels     !== undefined) songFields.source_labels     = source_labels;
  if (is_retired        !== undefined) songFields.is_retired        = is_retired;
  if (spotify_track_id  !== undefined) songFields.spotify_track_id  = spotify_track_id;
  if (Object.keys(songFields).length > 0) {
    const { error } = await supabase.from('songs').update(songFields).eq('id', id);
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

// PATCH /arrangements/:arrangementId — update an alternate arrangement
router.patch('/arrangements/:arrangementId', async (req: Request, res: Response) => {
  const { arrangementId } = req.params;
  const { name, source_label, key_signature, key_number, tempo_bpm, time_signature, energy_level } = req.body;

  const fields: Record<string, unknown> = {};
  if (name           !== undefined) fields.name           = name;
  if (source_label   !== undefined) fields.source_label   = source_label;
  if (key_signature  !== undefined) fields.key_signature  = key_signature;
  if (key_number     !== undefined) fields.key_number     = key_number;
  if (tempo_bpm      !== undefined) fields.tempo_bpm      = tempo_bpm;
  if (time_signature !== undefined) fields.time_signature = time_signature;
  if (energy_level   !== undefined) fields.energy_level   = energy_level;

  const { data, error } = await getSupabase()
    .from('arrangements')
    .update(fields)
    .eq('id', arrangementId)
    .select(ARRANGEMENT_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// DELETE /songs — bulk delete songs by id array
router.delete('/', async (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }
  const { error } = await getSupabase().from('songs').delete().in('id', ids);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ deleted: ids.length });
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

// DELETE /songs/:id — delete a single song (arrangements and metadata cascade)
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { error } = await getSupabase().from('songs').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
});

// GET /songs/:id/suggestions — score all arrangements per candidate, return best
router.get('/:id/suggestions', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { source_labels, since, within_years, pco_only,
    key_number, key_signature, tempo_bpm, time_signature, energy_level } = req.query;



  const { data: anchor, error: anchorError } = await getSupabase()
    .from('songs')
    .select(`*, arrangements(id, key_signature, key_number, tempo_bpm, time_signature, energy_level, is_primary), song_metadata(themes)`)
    .eq('id', id).single();

  if (anchorError || !anchor) return res.status(404).json({ error: 'Song not found' });

  const primaryArr = anchor.arrangements.find((a: any) => a.is_primary) ?? anchor.arrangements[0];

  let query = getSupabase()
    .from('songs')
    .select(`*, arrangements(${ARRANGEMENT_SELECT}), song_metadata(themes)`)
    .neq('id', id)
    .eq('is_retired', false);

  if (source_labels) {
    const labels = (source_labels as string).split(',');
    const quotedLabels = labels.map(l => `"${l}"`).join(',');
    query = query.or(`source_labels.ov.{${quotedLabels}},source_labels.eq.{}`);
  }
  if (since)         query = query.gte('released_at', since as string);
  if (within_years)  query = query.gte('released_year', new Date().getFullYear() - parseInt(within_years as string));
  if (pco_only === 'true') query = query.not('pco_song_id', 'is', null);

  const { data: candidates, error: candidatesError } = await query;
  if (candidatesError) return res.status(500).json({ error: candidatesError.message });

  // Allow caller to override the anchor arrangement (e.g. when anchoring on an alternate)
  const anchorForScoring: SongForScoring = {
    id: anchor.id, title: anchor.title, artist: anchor.artist,
    keyNumber:     key_number     ? parseInt(key_number as string)     : primaryArr.key_number,
    keySignature:  key_signature  ? (key_signature as string)          : primaryArr.key_signature,
    tempoBpm:      tempo_bpm      ? parseFloat(tempo_bpm as string)    : primaryArr.tempo_bpm,
    timeSignature: time_signature ? (time_signature as string)         : primaryArr.time_signature,
    energyLevel:   energy_level   ? parseInt(energy_level as string)   : primaryArr.energy_level,
    themes: (Array.isArray(anchor.song_metadata) ? anchor.song_metadata[0] : anchor.song_metadata)?.themes ?? [],
  };

  type CandidateWithMeta = { scoringObj: SongForScoring; isPrimary: boolean; primaryKeySignature: string; isPco: boolean };

  const candidatesWithMeta: CandidateWithMeta[] = (candidates ?? [])
    .map((song: any) => {
      const arrangements: any[] = song.arrangements ?? [];
      if (!arrangements.length) return null;
      const themes: string[] = (Array.isArray(song.song_metadata) ? song.song_metadata[0] : song.song_metadata)?.themes ?? [];
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
        scoringObj: { id: song.id, title: song.title, artist: song.artist, keyNumber: bestArr.key_number, keySignature: bestArr.key_signature, tempoBpm: bestArr.tempo_bpm, timeSignature: bestArr.time_signature, energyLevel: bestArr.energy_level, themes, arrangementId: bestArr.id } as SongForScoring,
        isPrimary: bestArr.is_primary,
        primaryKeySignature: primaryArr.key_signature,
        isPco: !!song.pco_song_id,
      };
    })
    .filter((c): c is CandidateWithMeta => c !== null);

  const results = scoreSongs(anchorForScoring, candidatesWithMeta.map(c => c.scoringObj));
  const enriched = results.map(result => {
    const meta = candidatesWithMeta.find(c => c.scoringObj.id === result.song.id);
    let r = result;
    if (meta?.isPco) {
      r = { ...r, reasons: [...r.reasons, 'In your PCO library'] };
    }
    if (meta && !meta.isPrimary) {
      r = { ...r, reasons: [...r.reasons, `Alternate key shown (${r.song.keySignature}) — primary is ${meta.primaryKeySignature}`] };
    }
    return r;
  });

  return res.json({ anchor: anchorForScoring, suggestions: enriched });
});

export default router;
