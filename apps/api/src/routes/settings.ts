import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabase';

const router = Router();

const BASE_TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4', '2/2', '12/8'];
const BASE_STYLES = ['modern', 'hymn', 'gospel', 'folk-worship'];

async function getCustomValues(key: string): Promise<string[]> {
  const { data } = await getSupabase()
    .from('app_settings')
    .select('values')
    .eq('key', key)
    .single();
  return data?.values ?? [];
}

async function setCustomValues(key: string, values: string[]): Promise<void> {
  await getSupabase()
    .from('app_settings')
    .update({ values })
    .eq('key', key);
}

// GET /settings
router.get('/', async (_req: Request, res: Response) => {
  const [customTimeSigs, customStyles] = await Promise.all([
    getCustomValues('custom_time_signatures'),
    getCustomValues('custom_styles'),
  ]);
  return res.json({
    time_signatures: { base: BASE_TIME_SIGNATURES, custom: customTimeSigs },
    styles:          { base: BASE_STYLES,           custom: customStyles  },
  });
});

// POST /settings/time_signatures
router.post('/time_signatures', async (req: Request, res: Response) => {
  const { value } = req.body;
  if (!value?.trim()) return res.status(400).json({ error: 'value is required' });
  const v = value.trim();
  const existing = await getCustomValues('custom_time_signatures');
  if (BASE_TIME_SIGNATURES.includes(v) || existing.includes(v)) {
    return res.status(409).json({ error: `"${v}" already exists` });
  }
  await setCustomValues('custom_time_signatures', [...existing, v]);
  return res.status(201).json({ value: v });
});

// DELETE /settings/time_signatures/:value
router.delete('/time_signatures/:value', async (req: Request, res: Response) => {
  const value = decodeURIComponent(req.params.value);
  if (BASE_TIME_SIGNATURES.includes(value)) {
    return res.status(400).json({ error: 'Cannot delete a base time signature' });
  }
  const { data: inUse } = await getSupabase()
    .from('arrangements')
    .select('id')
    .eq('time_signature', value)
    .limit(1);
  if (inUse?.length) {
    return res.status(400).json({ error: `"${value}" is in use — remove it from all songs first` });
  }
  const existing = await getCustomValues('custom_time_signatures');
  await setCustomValues('custom_time_signatures', existing.filter(v => v !== value));
  return res.status(204).send();
});

// POST /settings/styles
router.post('/styles', async (req: Request, res: Response) => {
  const { value } = req.body;
  if (!value?.trim()) return res.status(400).json({ error: 'value is required' });
  const v = value.trim();
  const existing = await getCustomValues('custom_styles');
  if (BASE_STYLES.includes(v) || existing.includes(v)) {
    return res.status(409).json({ error: `"${v}" already exists` });
  }
  await setCustomValues('custom_styles', [...existing, v]);
  return res.status(201).json({ value: v });
});

// DELETE /settings/styles/:value
router.delete('/styles/:value', async (req: Request, res: Response) => {
  const value = decodeURIComponent(req.params.value);
  if (BASE_STYLES.includes(value)) {
    return res.status(400).json({ error: 'Cannot delete a base style' });
  }
  const { data: inUse } = await getSupabase()
    .from('song_metadata')
    .select('song_id')
    .eq('style', value)
    .limit(1);
  if (inUse?.length) {
    return res.status(400).json({ error: `"${value}" is in use — update all songs using it first` });
  }
  const existing = await getCustomValues('custom_styles');
  await setCustomValues('custom_styles', existing.filter(v => v !== value));
  return res.status(204).send();
});

export default router;
