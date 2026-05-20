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
  const { error } = await getSupabase()
    .from('app_settings')
    .update({ values })
    .eq('key', key);
  if (error) throw new Error(`DB write failed for "${key}": ${error.message}`);
}

// GET /settings
router.get('/', async (_req: Request, res: Response) => {
  const [customTimeSigs, customStyles, sourceLabels, themes] = await Promise.all([
    getCustomValues('custom_time_signatures'),
    getCustomValues('custom_styles'),
    getCustomValues('custom_source_labels'),
    getCustomValues('custom_themes'),
  ]);
  return res.json({
    time_signatures: { base: BASE_TIME_SIGNATURES, custom: customTimeSigs },
    styles:          { base: BASE_STYLES,           custom: customStyles  },
    source_labels:   sourceLabels,
    themes,
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

// POST /settings/source_labels
router.post('/source_labels', async (req: Request, res: Response) => {
  const { value } = req.body;
  if (!value?.trim()) return res.status(400).json({ error: 'value is required' });
  const v = value.trim();
  try {
    const existing = await getCustomValues('custom_source_labels');
    if (existing.includes(v)) return res.status(409).json({ error: `"${v}" already exists` });
    await setCustomValues('custom_source_labels', [...existing, v].sort());
    return res.status(201).json({ value: v });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /settings/source_labels/:value
router.delete('/source_labels/:value', async (req: Request, res: Response) => {
  const value = decodeURIComponent(req.params.value);
  try {
    const existing = await getCustomValues('custom_source_labels');
    if (!existing.includes(value)) return res.status(404).json({ error: 'Label not found' });
    await setCustomValues('custom_source_labels', existing.filter(v => v !== value));
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /settings/source_labels/rename
router.patch('/source_labels/rename', async (req: Request, res: Response) => {
  const { from, to } = req.body;
  const f = from?.trim(), t = to?.trim();
  if (!f || !t) return res.status(400).json({ error: 'from and to are required' });
  try {
    const existing = await getCustomValues('custom_source_labels');
    if (!existing.includes(f)) return res.status(204).send();
    await setCustomValues('custom_source_labels', [...existing.filter(v => v !== f), t].sort());
    return res.status(200).json({ updated: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /settings/themes
router.post('/themes', async (req: Request, res: Response) => {
  const { value } = req.body;
  if (!value?.trim()) return res.status(400).json({ error: 'value is required' });
  const v = value.trim().toLowerCase();
  try {
    const existing = await getCustomValues('custom_themes');
    if (existing.includes(v)) return res.status(409).json({ error: `"${v}" already exists` });
    await setCustomValues('custom_themes', [...existing, v].sort());
    return res.status(201).json({ value: v });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /settings/themes/bulk — seed multiple themes at once
router.post('/themes/bulk', async (req: Request, res: Response) => {
  const { values } = req.body;
  if (!Array.isArray(values) || !values.length) return res.status(400).json({ error: 'values array is required' });
  try {
    const existing = await getCustomValues('custom_themes');
    const toAdd = values.map((v: string) => v.trim().toLowerCase()).filter((v: string) => v && !existing.includes(v));
    if (!toAdd.length) return res.json({ added: 0 });
    await setCustomValues('custom_themes', [...existing, ...toAdd].sort());
    return res.json({ added: toAdd.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /settings/themes/:value
router.delete('/themes/:value', async (req: Request, res: Response) => {
  const value = decodeURIComponent(req.params.value);
  try {
    const existing = await getCustomValues('custom_themes');
    if (!existing.includes(value)) return res.status(404).json({ error: 'Theme not found' });
    await setCustomValues('custom_themes', existing.filter(v => v !== value));
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /settings/themes/rename
router.patch('/themes/rename', async (req: Request, res: Response) => {
  const { from, to } = req.body;
  const f = from?.trim().toLowerCase(), t = to?.trim().toLowerCase();
  if (!f || !t) return res.status(400).json({ error: 'from and to are required' });
  try {
    const existing = await getCustomValues('custom_themes');
    if (!existing.includes(f)) return res.status(204).send();
    await setCustomValues('custom_themes', [...existing.filter(v => v !== f), t].sort());
    return res.status(200).json({ updated: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
