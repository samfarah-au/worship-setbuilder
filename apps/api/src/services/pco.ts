import { getSupabase } from './supabase';

const PCO_BASE = 'https://api.planningcenteronline.com/services/v2';
export const PCO_LABEL = 'Planning Center';

const KEY_TO_NUMBER: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11,
};

export interface PcoConfig {
  appId: string;
  secret: string;
}

export interface PcoSong {
  pcoId: string;
  title: string;
  author: string;
  ccliNumber: string | null;
}

export interface PcoArrangement {
  pcoId: string;
  name: string;
  bpm: number | null;
  key: string | null;
  keyNumber: number | null;
  timeSignature: string | null;
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
    return { appId: data.config.appId, secret: data.config.secret };
  }

  // Fall back to env
  if (process.env.PCO_APP_ID && process.env.PCO_SECRET) {
    return { appId: process.env.PCO_APP_ID, secret: process.env.PCO_SECRET };
  }

  return null;
}

export async function savePcoConfig(config: PcoConfig): Promise<void> {
  await getSupabase()
    .from('app_connections')
    .upsert({ key: 'pco', config });
}

export async function clearPcoConfig(): Promise<void> {
  await getSupabase().from('app_connections').delete().eq('key', 'pco');
}

export async function clearPcoLabel(): Promise<number> {
  const { data: songs } = await getSupabase()
    .from('songs')
    .select('id, source_labels')
    .overlaps('source_labels', [PCO_LABEL]);

  if (!songs?.length) return 0;

  await Promise.all(
    songs.map(song =>
      getSupabase()
        .from('songs')
        .update({ source_labels: song.source_labels.filter((l: string) => l !== PCO_LABEL) })
        .eq('id', song.id)
    )
  );

  return songs.length;
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
      });
    }
    if (!data.links?.next || (data.data ?? []).length < perPage) break;
    offset += perPage;
  }

  return songs;
}

export async function getPcoArrangements(pcoSongId: string, config: PcoConfig): Promise<PcoArrangement[]> {
  const data = await pcoGet(`/songs/${pcoSongId}/arrangements`, config);
  return (data.data ?? []).map((item: any) => {
    const key = item.attributes.chord_chart_key || null;
    return {
      pcoId: item.id,
      name: item.attributes.name || '',
      bpm: item.attributes.bpm ? Math.round(parseFloat(String(item.attributes.bpm))) : null,
      key,
      keyNumber: key ? (KEY_TO_NUMBER[key] ?? null) : null,
      timeSignature: item.attributes.time_signature || null,
    };
  });
}

export async function testPcoConnection(config: PcoConfig): Promise<boolean> {
  try {
    await pcoGet('/songs?per_page=1', config);
    return true;
  } catch {
    return false;
  }
}
