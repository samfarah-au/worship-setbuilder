import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabase';
import { addSong } from '../services/songs';
import {
  getPcoConfig, savePcoConfig, clearPcoConfig, clearPcoLabel,
  getPcoSongs, getPcoArrangements, testPcoConnection,
  PCO_LABEL, PcoConfig,
} from '../services/pco';

const router = Router();
const ARRANGEMENT_SELECT = 'id, name, source_label, key_signature, key_number, tempo_bpm, time_signature, energy_level, is_primary';

// GET /pco/config
router.get('/config', async (_req: Request, res: Response) => {
  const stored = await getSupabase()
    .from('app_connections').select('config').eq('key', 'pco').maybeSingle();

  const isStoredInDb = !!stored.data?.config?.appId;
  const appId = stored.data?.config?.appId ?? process.env.PCO_APP_ID ?? '';
  // Return actual secret only when pre-filling from env (not yet saved)
  const secret = isStoredInDb ? '••••••••' : (process.env.PCO_SECRET ?? '');

  const { count } = await getSupabase()
    .from('songs').select('id', { count: 'exact', head: true })
    .overlaps('source_labels', [PCO_LABEL]);

  return res.json({ configured: isStoredInDb, appId, secret, pcoSongCount: count ?? 0 });
});

// PUT /pco/config
router.put('/config', async (req: Request, res: Response) => {
  const { app_id, secret, reset } = req.body;

  if (reset) {
    const count = await clearPcoLabel();
    await clearPcoConfig();
    return res.json({ reset: true, clearedCount: count });
  }

  if (!app_id || !secret || secret === '••••••••') {
    return res.status(400).json({ error: 'app_id and secret are required' });
  }

  const newConfig: PcoConfig = { appId: app_id, secret };

  const ok = await testPcoConnection(newConfig);
  if (!ok) return res.status(400).json({ error: 'Could not connect to PCO with these credentials' });

  // If changing to a different account, remove old PCO labels first
  const existing = await getPcoConfig();
  let clearedCount = 0;
  if (existing && existing.appId !== app_id) {
    clearedCount = await clearPcoLabel();
  }

  await savePcoConfig(newConfig);
  return res.json({ saved: true, clearedCount });
});

// GET /pco/preview — classify PCO library against existing songs
router.get('/preview', async (_req: Request, res: Response) => {
  const config = await getPcoConfig();
  if (!config) return res.status(400).json({ error: 'PCO not configured' });

  try {
    const [pcoSongs, { data: existing }] = await Promise.all([
      getPcoSongs(config),
      getSupabase().from('songs').select('id, title, artist, ccli_number, source_labels'),
    ]);

    const results = pcoSongs.map(ps => {
      const ccliMatch = ps.ccliNumber
        ? existing?.find(s => s.ccli_number && s.ccli_number === ps.ccliNumber)
        : null;
      const titleMatch = !ccliMatch
        ? existing?.find(s => s.title.toLowerCase().trim() === ps.title.toLowerCase().trim())
        : null;
      const match = ccliMatch || titleMatch;

      let status: 'imported' | 'match' | 'new';
      if (match?.source_labels?.includes(PCO_LABEL)) status = 'imported';
      else if (match) status = 'match';
      else status = 'new';

      return {
        pcoId: ps.pcoId,
        title: ps.title,
        author: ps.author,
        ccliNumber: ps.ccliNumber,
        status,
        existingSongId: match?.id ?? null,
        existingTitle: match?.title ?? null,
        matchedBy: ccliMatch ? 'ccli' : titleMatch ? 'title' : null,
      };
    });

    return res.json(results);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /pco/import
router.post('/import', async (req: Request, res: Response) => {
  const { pco_song_ids, overwrite_metadata = false } = req.body;
  const config = await getPcoConfig();
  if (!config) return res.status(400).json({ error: 'PCO not configured' });

  try {
    const [pcoSongs, { data: existing }] = await Promise.all([
      getPcoSongs(config),
      getSupabase()
        .from('songs')
        .select(`id, title, artist, ccli_number, source_labels, arrangements(${ARRANGEMENT_SELECT})`),
    ]);

    const toProcess = pco_song_ids?.length
      ? pcoSongs.filter(ps => pco_song_ids.includes(ps.pcoId))
      : pcoSongs;

    let added = 0, matched = 0, skipped = 0;
    const errors: string[] = [];

    for (const ps of toProcess) {
      try {
        const ccliMatch = ps.ccliNumber
          ? existing?.find(s => s.ccli_number && s.ccli_number === ps.ccliNumber)
          : null;
        const titleMatch = !ccliMatch
          ? existing?.find(s => s.title.toLowerCase().trim() === ps.title.toLowerCase().trim())
          : null;
        const song = ccliMatch || titleMatch;

        if (song) {
          const alreadyImported = song.source_labels?.includes(PCO_LABEL);
          if (alreadyImported && !overwrite_metadata) { skipped++; continue; }

          const newLabels = alreadyImported
            ? song.source_labels
            : [...(song.source_labels ?? []), PCO_LABEL];

          await getSupabase().from('songs').update({ source_labels: newLabels }).eq('id', song.id);

          if (overwrite_metadata) {
            const pcoArrs = await getPcoArrangements(ps.pcoId, config);
            const pcoArr = pcoArrs[0];
            if (pcoArr) {
              const primary = (song.arrangements as any[])?.find((a: any) => a.is_primary);
              if (primary) {
                const fields: Record<string, unknown> = {};
                if (pcoArr.bpm) fields.tempo_bpm = pcoArr.bpm;
                if (pcoArr.key) { fields.key_signature = pcoArr.key; fields.key_number = pcoArr.keyNumber; }
                if (pcoArr.timeSignature) fields.time_signature = pcoArr.timeSignature;
                if (Object.keys(fields).length) {
                  await getSupabase().from('arrangements').update(fields).eq('id', primary.id);
                }
              }
            }
          }
          matched++;
        } else {
          const pcoArrs = await getPcoArrangements(ps.pcoId, config);
          const pcoArr = pcoArrs[0];

          await addSong({
            title: ps.title,
            artist: ps.author || 'Unknown',
            sourceLabels: [PCO_LABEL],
            ccliNumber: ps.ccliNumber ?? undefined,
            keySignature: pcoArr?.key ?? 'G',
            keyNumber: pcoArr?.keyNumber ?? 7,
            tempoBpm: pcoArr?.bpm ?? 72,
            timeSignature: pcoArr?.timeSignature ?? '4/4',
            themes: [],
            theologicalDepth: 2,
            style: 'modern',
            isHymn: false,
          });
          added++;
        }
      } catch (err: any) {
        errors.push(`${ps.title}: ${err.message}`);
      }
    }

    return res.json({ added, matched, skipped, errors });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
