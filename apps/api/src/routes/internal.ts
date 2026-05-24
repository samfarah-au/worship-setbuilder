import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabase';
import snapshot from '../seeds/snapshot.json';

const router = Router();

// GET /internal/reset — called by Vercel Cron
// Protected by Authorization: Bearer <CRON_SECRET>
router.get('/reset', async (req: Request, res: Response) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'CRON_SECRET not configured' });

  const auth = req.headers.authorization ?? '';
  if (auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = getSupabase();

    // Delete in FK-safe order (arrangements + song_metadata cascade from songs)
    await db.from('app_settings').delete().neq('key', '___never___');
    await db.from('songs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Re-insert app_settings
    if (snapshot.app_settings.length) {
      const { error } = await db.from('app_settings').insert(snapshot.app_settings);
      if (error) throw new Error(`app_settings insert: ${error.message}`);
    }

    // Re-insert songs (released_year is a generated column — omit it)
    if (snapshot.songs.length) {
      const songs = snapshot.songs.map(({ ...s }: any) => s);
      const { error } = await db.from('songs').insert(songs);
      if (error) throw new Error(`songs insert: ${error.message}`);
    }

    // Re-insert arrangements
    if (snapshot.arrangements.length) {
      const { error } = await db.from('arrangements').insert(snapshot.arrangements);
      if (error) throw new Error(`arrangements insert: ${error.message}`);
    }

    // Re-insert song_metadata
    if (snapshot.song_metadata.length) {
      const { error } = await db.from('song_metadata').insert(snapshot.song_metadata);
      if (error) throw new Error(`song_metadata insert: ${error.message}`);
    }

    const ts = new Date().toISOString();
    console.log(`[reset] Completed at ${ts}`);
    return res.json({
      ok: true,
      restoredAt: ts,
      songs: snapshot.songs.length,
      arrangements: snapshot.arrangements.length,
    });
  } catch (err: any) {
    console.error('[reset] Failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
