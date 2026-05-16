import path from 'path';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

async function getAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export async function getTrackMetadata(trackId: string) {
  const token = await getAccessToken();

  const res = await fetch(`${SPOTIFY_API_URL}/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const track = await res.json() as any;

  if (track.error) {
    throw new Error(`Spotify error: ${track.error.message}`);
  }

  return {
    title:          track.name,
    artist:         track.artists[0].name,
    album:          track.album.name,
    releasedAt:     new Date(track.album.release_date),
    spotifyTrackId: track.id,
    spotifyUrl:     track.external_urls.spotify,
  };
}

// Returns all matching versions of a song (studio, live, etc.)
// so the user can pick which to add as the canonical entry or arrangements
export async function searchTrack(title: string, artist: string) {
  const token = await getAccessToken();
  const query = encodeURIComponent(`track:${title} artist:${artist}`);

  const res = await fetch(`${SPOTIFY_API_URL}/search?q=${query}&type=track&limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json() as any;

  return (data.tracks?.items ?? []).map((r: any) => ({
    spotifyTrackId: r.id,
    title:          r.name,
    artist:         r.artists[0].name,
    album:          r.album.name,
    releasedAt:     new Date(r.album.release_date),
    spotifyUrl:     r.external_urls.spotify,
    isLive:         r.name.toLowerCase().includes('live'),
  }));
}