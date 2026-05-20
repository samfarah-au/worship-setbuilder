import { getSupabase } from './supabase';

const PCO_BASE = 'https://api.planningcenteronline.com/services/v2';
export const PCO_LABEL = 'Planning Center';

export const KEY_TO_NUMBER: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11,
};

export interface PcoConfig {
  appId: string;
  secret: string;
  serviceTypeId?: string;
}

export interface PcoServiceType {
  id: string;
  name: string;
}

export interface PcoSong {
  pcoId: string;
  title: string;
  author: string;
  ccliNumber: string | null;
  lastScheduledAt: string | null;
  hidden: boolean;
}

export interface PcoArrangement {
  pcoId: string;
  name: string;
  bpm: number | null;
  key: string | null;
  keyNumber: number | null;
  timeSignature: string | null;
  assignedKeys: string[];
}

async function pcoGet(path: string, config: PcoConfig): Promise<any> {
  const creds = Buffer.from(`${config.appId}:${config.secret}`).toString('base64');
  const res = await fetch(`${PCO_BASE}${path}`, {
    headers: { Authorization: `Basic ${creds}` },
  });
  if (!res.ok) throw new Error(`PCO API ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function getPcoConfig(): Promise<PcoConfig | null> {
  const { data } = await getSupabase()
    .from('app_connections')
    .select('config')
    .eq('key', 'pco')
    .maybeSingle();

  if (data?.config?.appId && data?.config?.secret) {
    return {
      appId: data.config.appId,
      secret: data.config.secret,
      serviceTypeId: data.config.serviceTypeId ?? undefined,
    };
  }

  // Fall back to env
  if (process.env.PCO_APP_ID && process.env.PCO_SECRET) {
    return { appId: process.env.PCO_APP_ID, secret: process.env.PCO_SECRET };
  }

  return null;
}

export async function savePcoConfig(config: PcoConfig): Promise<void> {
  const { error } = await getSupabase()
    .from('app_connections')
    .upsert({ key: 'pco', config }, { onConflict: 'key' });
  if (error) throw new Error(`Failed to save PCO config: ${error.message}`);
}

export async function clearPcoConfig(): Promise<void> {
  await getSupabase().from('app_connections').delete().eq('key', 'pco');
}

export async function clearPcoConnections(): Promise<number> {
  const { count } = await getSupabase()
    .from('songs')
    .select('id', { count: 'exact', head: true })
    .not('pco_song_id', 'is', null);

  if (!count) return 0;

  await getSupabase()
    .from('songs')
    .update({ pco_song_id: null })
    .not('pco_song_id', 'is', null);

  return count;
}

export async function getPcoSongs(config: PcoConfig): Promise<PcoSong[]> {
  const songs: PcoSong[] = [];
  let offset = 0;
  const perPage = 100;

  while (true) {
    const data = await pcoGet(`/songs?per_page=${perPage}&offset=${offset}`, config);
    for (const item of (data.data ?? [])) {
      songs.push({
        pcoId: item.id,
        title: item.attributes.title,
        author: item.attributes.author || item.attributes.author_name || '',
        ccliNumber: item.attributes.ccli_number ? String(item.attributes.ccli_number) : null,
        lastScheduledAt: item.attributes.last_scheduled_at ?? null,
        hidden: item.attributes.hidden ?? false,
      });
    }
    if (!data.links?.next || (data.data ?? []).length < perPage) break;
    offset += perPage;
  }

  return songs;
}

export async function getPcoArrangements(pcoSongId: string, config: PcoConfig): Promise<PcoArrangement[]> {
  const data = await pcoGet(`/songs/${pcoSongId}/arrangements`, config);
  return Promise.all((data.data ?? []).map(async (item: any) => {
    const key = item.attributes.chord_chart_key || null;
    const keysData = await pcoGet(`/songs/${pcoSongId}/arrangements/${item.id}/keys`, config);
    const assignedKeys: string[] = (keysData.data ?? [])
      .map((k: any) => k.attributes.starting_key as string)
      .filter(Boolean);
    return {
      pcoId: item.id,
      name: item.attributes.name || '',
      bpm: item.attributes.bpm ? Math.round(parseFloat(String(item.attributes.bpm))) : null,
      key,
      keyNumber: key ? (KEY_TO_NUMBER[key] ?? null) : null,
      timeSignature: item.attributes.meter || null,
      assignedKeys,
    };
  }));
}

export async function getPcoServiceTypes(config: PcoConfig): Promise<PcoServiceType[]> {
  const data = await pcoGet('/service_types', config);
  return (data.data ?? [])
    .map((item: any) => ({ id: item.id, name: item.attributes.name as string }))
    .sort((a: PcoServiceType, b: PcoServiceType) => a.name.localeCompare(b.name));
}

// Returns Map<pcoSongId, isoDateString> for songs scheduled in the given service type.
// Fetches plans sorted newest-first; each plan's song items are batch-fetched 5 at a time.
export async function getServiceTypeSchedule(
  config: PcoConfig,
  serviceTypeId: string,
  onProgress?: (processed: number) => void,
): Promise<Map<string, string>> {
  const schedule = new Map<string, string>();
  let offset = 0;
  const perPage = 100;
  const maxPlans = 100;
  let totalProcessed = 0;

  while (offset < maxPlans) {
    const data = await pcoGet(
      `/service_types/${serviceTypeId}/plans?order=-sort_date&per_page=${perPage}&offset=${offset}`,
      config,
    );
    const plans: any[] = data.data ?? [];
    if (!plans.length) break;

    for (let i = 0; i < plans.length; i += 10) {
      await Promise.all(plans.slice(i, i + 10).map(async (plan: any) => {
        const planDate: string = (plan.attributes.sort_date ?? '').split('T')[0];
        if (!planDate) return;
        try {
          const itemsData = await pcoGet(
            `/service_types/${serviceTypeId}/plans/${plan.id}/items?filter=song_items&per_page=100`,
            config,
          );
          for (const item of (itemsData.data ?? [])) {
            const songId = item.relationships?.song?.data?.id;
            if (!songId) continue;
            const existing = schedule.get(songId);
            if (!existing || planDate > existing) {
              schedule.set(songId, planDate);
            }
          }
        } catch { /* skip plans that fail */ }
      }));
      totalProcessed += Math.min(10, plans.length - i);
      onProgress?.(totalProcessed);
    }

    if (!data.links?.next || plans.length < perPage) break;
    offset += perPage;
  }

  return schedule;
}

export async function testPcoConnection(config: PcoConfig): Promise<boolean> {
  try {
    await pcoGet('/songs?per_page=1', config);
    return true;
  } catch {
    return false;
  }
}
