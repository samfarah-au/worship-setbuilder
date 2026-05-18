const WEIGHTS = {
  key:    0.25,
  tempo:  0.20,
  meter:  0.15,
  energy: 0.20,
  theme:  0.20,
};

export interface SongForScoring {
  id: string;
  title: string;
  artist: string;
  keyNumber: number;
  keySignature: string;
  tempoBpm: number;
  timeSignature: string;
  energyLevel: number;
  themes: string[];
}

export interface ScoreResult {
  song: SongForScoring;
  total: number;
  breakdown: {
    key: number;
    tempo: number;
    meter: number;
    energy: number;
    theme: number;
  };
  reasons: string[];
}

function keyScore(a: number, b: number): number {
  const diff = Math.abs(a - b) % 12;
  const distance = Math.min(diff, 12 - diff);
  const scores = [1.0, 0.85, 0.7, 0.55, 0.4, 0.25, 0.0, 0.25, 0.4, 0.55, 0.7, 0.85];
  return scores[distance] ?? 0;
}

function tempoScore(a: number, b: number): number {
  const diff = Math.abs(a - b);
  if (diff <= 5)  return 1.0;
  if (diff <= 10) return 0.85;
  if (diff <= 20) return 0.65;
  if (diff <= 35) return 0.4;
  return 0.1;
}

function meterScore(a: string, b: string): number {
  if (a === b) return 1.0;
  const compatible: Record<string, string[]> = {
    '4/4': ['2/4', '2/2'],
    '6/8': ['12/8'],
  };
  return compatible[a]?.includes(b) ? 0.6 : 0.0;
}

function energyScore(a: number, b: number): number {
  const diff = Math.abs(a - b);
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.8;
  if (diff === 2) return 0.5;
  return 0.15;
}

function themeScore(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const aSet = new Set(a);
  const overlap = b.filter(t => aSet.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return overlap / union;
}

function buildReasons(
  anchor: SongForScoring,
  candidate: SongForScoring,
  scores: { key: number; tempo: number; meter: number; theme: number }
): string[] {
  const reasons: string[] = [];

  if (scores.key === 1.0) {
    reasons.push(`Same key (${anchor.keySignature})`);
  } else if (scores.key >= 0.7) {
    reasons.push(`Related keys (${anchor.keySignature} → ${candidate.keySignature})`);
  }

  if (scores.tempo >= 0.85) {
    reasons.push(`Similar tempo (${anchor.tempoBpm} → ${candidate.tempoBpm} BPM)`);
  } else if (scores.tempo <= 0.4) {
    reasons.push(`Big tempo shift (${anchor.tempoBpm} → ${candidate.tempoBpm} BPM) — intentional?`);
  }

  if (scores.meter === 1.0) {
    reasons.push(`Same time signature (${anchor.timeSignature})`);
  } else if (scores.meter === 0) {
    reasons.push(`Time signature change (${anchor.timeSignature} → ${candidate.timeSignature})`);
  }

  if (scores.theme > 0) {
    const shared = anchor.themes.filter(t => candidate.themes.includes(t));
    if (shared.length) reasons.push(`Shared themes: ${shared.join(', ')}`);
  }

  return reasons;
}

export function scoreSongs(
  anchor: SongForScoring,
  candidates: SongForScoring[]
): ScoreResult[] {
  return candidates
    .filter(c => c.id !== anchor.id)
    .map(candidate => {
      const k  = keyScore(anchor.keyNumber, candidate.keyNumber);
      const t  = tempoScore(anchor.tempoBpm, candidate.tempoBpm);
      const m  = meterScore(anchor.timeSignature, candidate.timeSignature);
      const e  = energyScore(anchor.energyLevel, candidate.energyLevel);
      const th = themeScore(anchor.themes, candidate.themes);

      const total =
        k  * WEIGHTS.key   +
        t  * WEIGHTS.tempo +
        m  * WEIGHTS.meter +
        e  * WEIGHTS.energy +
        th * WEIGHTS.theme;

      const breakdown = { key: k, tempo: t, meter: m, energy: e, theme: th };
      const reasons = buildReasons(anchor, candidate, breakdown);

      return { song: candidate, total, breakdown, reasons };
    })
    .sort((a, b) => b.total - a.total);
}