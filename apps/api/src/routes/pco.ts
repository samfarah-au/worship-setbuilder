import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabase';
import { addSong } from '../services/songs';
import {
  getPcoConfig, savePcoConfig, clearPcoConfig, clearPcoConnections,
  getPcoSongs, getPcoArrangements, testPcoConnection, getPcoServiceTypes,
  getServiceTypeSchedule, KEY_TO_NUMBER, PcoConfig,
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
  const serviceTypeId: string | null = stored.data?.config?.serviceTypeId ?? null;

  const { count } = await getSupabase()
    .from('songs').select('id', { count: 'exact', head: true })
    .not('pco_song_id', 'is', null);

  return res.json({ configured: isStoredInDb, appId, secret, pcoSongCount: count ?? 0, serviceTypeId });
});

// PUT /pco/config
router.put('/config', async (req: Request, res: Response) => {
  const { app_id, secret, reset, service_type_id } = req.body;

  if (reset) {
    const count = await clearPcoConnections();
    await clearPcoConfig();
    return res.json({ reset: true, clearedCount: count });
  }

  // Service-type-only update — no need to re-test credentials
  if (service_type_id !== undefined && !app_id) {
    const existing = await getPcoConfig();
    if (!existing) return res.status(400).json({ error: 'PCO not configured' });
    const updated: PcoConfig = {
      ...existing,
      serviceTypeId: service_type_id || undefined,
    };
    await savePcoConfig(updated);
    return res.json({ saved: true });
  }

  if (!app_id) {
    return res.status(400).json({ error: 'app_id is required' });
  }

  // Allow blank secret if credentials are already stored — reuse the stored secret
  const existing = await getPcoConfig();
  const resolvedSecret = (secret && secret !== '••••••••') ? secret : existing?.secret;
  if (!resolvedSecret) {
    return res.status(400).json({ error: 'secret is required (no stored credentials found)' });
  }

  const newConfig: PcoConfig = {
    appId: app_id,
    secret: resolvedSecret,
    serviceTypeId: existing?.serviceTypeId,
  };

  const ok = await testPcoConnection(newConfig);
  if (!ok) return res.status(400).json({ error: 'Could not connect to PCO with these credentials' });

  // If changing to a different account, remove old PCO labels first
  let clearedCount = 0;
  if (existing && existing.appId !== app_id) {
    clearedCount = await clearPcoConnections();
    newConfig.serviceTypeId = undefined;
  }

  await savePcoConfig(newConfig);
  return res.json({ saved: true, clearedCount });
});

// GET /pco/service-types
router.get('/service-types', async (_req: Request, res: Response) => {
  const config = await getPcoConfig();
  if (!config) return res.status(400).json({ error: 'PCO not configured' });
  try {
    const serviceTypes = await getPcoServiceTypes(config);
    return res.json(serviceTypes);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /pco/sync-schedule — scans up to 50 recent plans, updates last_scheduled_at,
// and adds any new alternate arrangements/keys found in PCO.
router.post('/sync-schedule', async (req: Request, res: Response) => {
  try {
    const config = await getPcoConfig();
    if (!config) return res.status(400).json({ error: 'PCO not configured' });
    const serviceTypeId: string | undefined = req.body?.service_type_id ?? config.serviceTypeId;
    if (!serviceTypeId) return res.status(400).json({ error: 'No service type configured' });

    const [schedule, { data: songs }] = await Promise.all([
      getServiceTypeSchedule(config, serviceTypeId),
      getSupabase()
        .from('songs')
        .select(`id, pco_song_id, arrangements(${ARRANGEMENT_SELECT})`)
        .not('pco_song_id', 'is', null),
    ]);

    let updated = 0;
    let newArrangements = 0;

    for (const song of (songs ?? [])) {
      const lastScheduledAt = schedule.get(song.pco_song_id) ?? null;
      await getSupabase().from('songs').update({ last_scheduled_at: lastScheduledAt }).eq('id', song.id);
      updated++;

      // Check PCO for new alternate keys not already in the DB
      try {
        const pcoArrs = await getPcoArrangements(song.pco_song_id, config);
        const pcoArr = pcoArrs[0];
        if (pcoArr?.assignedKeys?.length) {
          const existingArrs = song.arrangements as any[];
          const primary = existingArrs?.find((a: any) => a.is_primary);
          const existingKeys = new Set(existingArrs.map((a: any) => a.key_signature));
          const bpm = pcoArr.bpm ?? primary?.tempo_bpm ?? 72;
          const timeSig = pcoArr.timeSignature ?? primary?.time_signature ?? '4/4';

          for (const altKey of pcoArr.assignedKeys) {
            if (existingKeys.has(altKey) || KEY_TO_NUMBER[altKey] === undefined) continue;
            await getSupabase().from('arrangements').insert({
              song_id: song.id,
              name: `Alternate Key: ${altKey}`,
              key_signature: altKey,
              key_number: KEY_TO_NUMBER[altKey],
              tempo_bpm: bpm,
              time_signature: timeSig,
              energy_level: bpmToEnergy(bpm, timeSig),
              is_primary: false,
            });
            newArrangements++;
          }
        }
      } catch { /* skip arrangement update for this song if PCO call fails */ }
    }

    const parts = [`Updated ${updated} songs`];
    if (newArrangements > 0) parts.push(`added ${newArrangements} new arrangement${newArrangements !== 1 ? 's' : ''}`);
    return res.json({ updated, newArrangements, message: parts.join(', ') });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /pco/preview — classify PCO library against existing songs
router.get('/preview', async (_req: Request, res: Response) => {
  const config = await getPcoConfig();
  if (!config) return res.status(400).json({ error: 'PCO not configured' });

  try {
    const [pcoSongs, { data: existing }] = await Promise.all([
      getPcoSongs(config),
      getSupabase().from('songs').select('id, title, artist, ccli_number, pco_song_id'),
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
      if (match?.pco_song_id) status = 'imported';
      else if (match) status = 'match';
      else status = 'new';

      return {
        pcoId: ps.pcoId,
        title: ps.title,
        author: ps.author,
        ccliNumber: ps.ccliNumber,
        hidden: ps.hidden,
        status,
        existingSongId: match?.id ?? null,
        existingTitle: match?.title ?? null,
        matchedBy: ccliMatch ? 'ccli' : titleMatch ? 'title' : null,
      };
    });

    results.sort((a, b) => a.title.localeCompare(b.title));
    return res.json(results);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

function inferSourceLabel(candidates: string[], knownLabels: string[]): string | null {
  let best: string | null = null;
  for (const text of candidates) {
    if (!text) continue;
    const lower = text.toLowerCase();
    for (const label of knownLabels) {
      if (label && lower.includes(label.toLowerCase())) {
        if (!best || label.length > best.length) best = label;
      }
    }
  }
  return best;
}

function bpmToEnergy(bpm: number, timeSignature = '4/4'): number {
  const feltBpm = (timeSignature === '6/8' || timeSignature === '12/8') ? bpm / 1.5 : bpm;
  if (feltBpm < 65)  return 1;
  if (feltBpm < 86)  return 2;
  if (feltBpm < 111) return 3;
  if (feltBpm < 131) return 4;
  return 5;
}

// POST /pco/import
router.post('/import', async (req: Request, res: Response) => {
  const { pco_song_ids, overwrite_metadata = false } = req.body;
  const config = await getPcoConfig();
  if (!config) return res.status(400).json({ error: 'PCO not configured' });

  try {
    const [pcoSongs, { data: existing }, { data: labelSettings }, serviceTypeSchedule] = await Promise.all([
      getPcoSongs(config),
      getSupabase()
        .from('songs')
        .select(`id, title, artist, ccli_number, pco_song_id, source_labels, arrangements(${ARRANGEMENT_SELECT})`),
      getSupabase().from('app_settings').select('values').eq('key', 'custom_source_labels').maybeSingle(),
      config.serviceTypeId ? getServiceTypeSchedule(config, config.serviceTypeId) : Promise.resolve(null),
    ]);

    // Build the known labels list: settings-defined first (user intent), then in-use labels from songs
    const knownLabels: string[] = [
      ...(labelSettings?.values ?? []),
      ...new Set((existing ?? []).flatMap((s: any) => s.source_labels ?? [])),
    ];

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

        // Always fetch arrangements — needed for name, musical data, and alternate keys
        const pcoArrs = await getPcoArrangements(ps.pcoId, config);
        const pcoArr = pcoArrs[0];
        const bpm = pcoArr?.bpm ?? 72;
        const inferredLabel = inferSourceLabel([ps.author, pcoArr?.name ?? ''], knownLabels);

        if (song) {
          const alreadyImported = !!song.pco_song_id;

          // Always refresh scheduling data; add inferred source label if not already present
          const lastScheduledAt = serviceTypeSchedule
            ? (serviceTypeSchedule.get(ps.pcoId) ?? null)
            : ps.lastScheduledAt;
          const songUpdate: Record<string, unknown> = {
            pco_song_id: ps.pcoId,
            last_scheduled_at: lastScheduledAt,
          };
          if (inferredLabel && !(song.source_labels ?? []).includes(inferredLabel)) {
            songUpdate.source_labels = [...(song.source_labels ?? []), inferredLabel];
          }
          await getSupabase().from('songs').update(songUpdate).eq('id', song.id);

          if (pcoArr) {
            const existingArrs = song.arrangements as any[];
            const primary = existingArrs?.find((a: any) => a.is_primary);

            // Always update arrangement name; only update musical data when overwriting
            if (primary) {
              const fields: Record<string, unknown> = {};
              if (pcoArr.name) fields.name = pcoArr.name;
              if (overwrite_metadata) {
                if (pcoArr.bpm) { fields.tempo_bpm = pcoArr.bpm; fields.energy_level = bpmToEnergy(pcoArr.bpm, pcoArr.timeSignature ?? '4/4'); }
                if (pcoArr.key) { fields.key_signature = pcoArr.key; fields.key_number = pcoArr.keyNumber; }
                if (pcoArr.timeSignature) fields.time_signature = pcoArr.timeSignature;
              }
              if (Object.keys(fields).length) {
                await getSupabase().from('arrangements').update(fields).eq('id', primary.id);
              }
            }

            // Add alternate arrangements for any assigned keys not already present
            const primaryKey = (overwrite_metadata && pcoArr.key) ? pcoArr.key : primary?.key_signature;
            const existingAltKeys = new Set(
              existingArrs.filter((a: any) => !a.is_primary).map((a: any) => a.key_signature)
            );
            for (const altKey of pcoArr.assignedKeys) {
              if (altKey === primaryKey || existingAltKeys.has(altKey) || KEY_TO_NUMBER[altKey] === undefined) continue;
              await getSupabase().from('arrangements').insert({
                song_id: song.id,
                name: `Alternate Key: ${altKey}`,
                key_signature: altKey,
                key_number: KEY_TO_NUMBER[altKey],
                tempo_bpm: bpm,
                time_signature: pcoArr.timeSignature ?? '4/4',
                energy_level: bpmToEnergy(bpm, pcoArr.timeSignature ?? '4/4'),
                is_primary: false,
              });
            }
          }

          if (alreadyImported && !overwrite_metadata) { skipped++; continue; }
          matched++;
        } else {
          const songRow = await addSong({
            title: ps.title,
            artist: ps.author || 'Unknown',
            sourceLabels: inferredLabel ? [inferredLabel] : [],
            ccliNumber: ps.ccliNumber ?? undefined,
            keySignature: pcoArr?.key ?? 'G',
            keyNumber: pcoArr?.keyNumber ?? 7,
            tempoBpm: bpm,
            timeSignature: pcoArr?.timeSignature ?? '4/4',
            energyLevel: bpmToEnergy(bpm, pcoArr?.timeSignature ?? '4/4'),
            arrangementName: pcoArr?.name || undefined,
            themes: [],
            theologicalDepth: 2,
            style: 'modern',
            isHymn: false,
            pcoSongId: ps.pcoId,
            lastScheduledAt: (serviceTypeSchedule
              ? (serviceTypeSchedule.get(ps.pcoId) ?? null)
              : ps.lastScheduledAt) ?? undefined,
          });

          // Add alternate arrangements for each assigned key
          if (pcoArr) {
            for (const altKey of pcoArr.assignedKeys) {
              if (altKey === (pcoArr.key ?? 'G') || KEY_TO_NUMBER[altKey] === undefined) continue;
              await getSupabase().from('arrangements').insert({
                song_id: songRow.id,
                name: `Alternate Key: ${altKey}`,
                key_signature: altKey,
                key_number: KEY_TO_NUMBER[altKey],
                tempo_bpm: bpm,
                time_signature: pcoArr.timeSignature ?? '4/4',
                energy_level: bpmToEnergy(bpm, pcoArr.timeSignature ?? '4/4'),
                is_primary: false,
              });
            }
          }
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
