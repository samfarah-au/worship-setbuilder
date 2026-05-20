const WEIGHTS = {
  key:   0.45,
  tempo: 0.35,
  meter: 0.15,
  theme: 0.05,
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
  arrangementId?: string;
}

export interface ScoreResult {
  song: SongForScoring;
  total: number;
  breakdown: {
    key: number;
    tempo: number;
    meter: number;
    theme: number;
  };
  reasons: string[];
}

function isMinorKey(sig: string): boolean {
  return sig.endsWith('m');
}

function chromaticKeyScore(a: number, b: number): number {
  const diff = Math.abs(a - b) % 12;
  const distance = Math.min(diff, 12 - diff);
  // Circle-of-fifths aware: P4/P5 (distance 5) are natural modulations.
  const scores = [1.0, 0.15, 0.45, 0.40, 0.25, 0.65, 0.05];
  return scores[distance] ?? 0;
}

function keyScore(aNum: number, aSig: string, bNum: number, bSig: string): number {
  const aMinor = isMinorKey(aSig);
  const bMinor = isMinorKey(bSig);

  // Same pitch class
  if (aNum === bNum) {
    // Same key: perfect match
    if (aMinor === bMinor) return 1.0;
    // Parallel major/minor (e.g. Am vs A): close but harmonically distinct
    return 0.65;
  }

  // Relative major/minor: a minor key's relative major is 3 semitones up.
  // Am(9)+3=12%12=0=C, Em(4)+3=7=G, Dm(2)+3=5=F, etc.
  if (aMinor && !bMinor && (aNum + 3) % 12 === bNum) return 0.85;
  if (!aMinor && bMinor && (bNum + 3) % 12 === aNum) return 0.85;

  // Same mode: use chromatic distance table
  if (aMinor === bMinor) return chromaticKeyScore(aNum, bNum);

  // Different modes, not relative: slight discount vs same-mode chromatic
  return chromaticKeyScore(aNum, bNum) * 0.8;
}

function tempoScore(a: number, b: number): number {
  const diff = Math.abs(a - b);
  if (diff === 0)  return 1.0;
  if (diff <= 5)   return 0.9  + (5  - diff) * 0.02;   // 0.98 → 0.90
  if (diff <= 10)  return 0.75 + (10 - diff) * 0.03;   // 0.87 → 0.75
  if (diff <= 20)  return 0.55 + (20 - diff) * 0.02;   // 0.73 → 0.55
  if (diff <= 35)  return 0.3  + (35 - diff) * 0.017;  // 0.54 → 0.30
  return 0.1;
}

function meterScore(sigA: string, bpmA: number, sigB: string, bpmB: number): number {
  if (sigA === sigB) return 1.0;

  const simpleDuple = new Set(['4/4', '2/4', '2/2']);
  if (simpleDuple.has(sigA) && simpleDuple.has(sigB)) return 0.75;

  const compound = new Set(['6/8', '12/8']);
  if (compound.has(sigA) && compound.has(sigB)) return 0.75;

  const is34_68 =
    (sigA === '3/4' && sigB === '6/8') || (sigA === '6/8' && sigB === '3/4');
  if (is34_68) return 0.55;

  const is44_34 =
    (sigA === '4/4' && sigB === '3/4') || (sigA === '3/4' && sigB === '4/4');
  if (is44_34) {
    const ratio = Math.max(bpmA, bpmB) / Math.min(bpmA, bpmB);
    return ratio < 1.2 ? 0.55 : 0.20;
  }

  const is44_68 =
    (sigA === '4/4' && sigB === '6/8') || (sigA === '6/8' && sigB === '4/4');
  if (is44_68) {
    const ratio = Math.max(bpmA, bpmB) / Math.min(bpmA, bpmB);
    if (ratio > 1.7 && ratio < 2.4) return 0.50;
    if (ratio < 1.2)               return 0.05;
    return 0.20;
  }

  return 0.10;
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

  // Key
  if (scores.key === 1.0) {
    reasons.push(`Same key (${anchor.keySignature})`);
  } else if (scores.key >= 0.8) {
    const anchorMinor = isMinorKey(anchor.keySignature);
    const candidateMinor = isMinorKey(candidate.keySignature);
    if (anchorMinor && !candidateMinor) {
      reasons.push(`Relative major (${anchor.keySignature} → ${candidate.keySignature})`);
    } else if (!anchorMinor && candidateMinor) {
      reasons.push(`Relative minor (${anchor.keySignature} → ${candidate.keySignature})`);
    } else {
      reasons.push(`Compatible keys — ${anchor.keySignature} → ${candidate.keySignature}`);
    }
  } else if (scores.key >= 0.6) {
    reasons.push(`Compatible keys — ${anchor.keySignature} → ${candidate.keySignature}`);
  } else if (scores.key >= 0.35) {
    reasons.push(`Key change needed — ${anchor.keySignature} → ${candidate.keySignature}`);
  } else {
    reasons.push(`Difficult key change — ${anchor.keySignature} → ${candidate.keySignature}`);
  }

  // Tempo
  if (scores.tempo === 1.0) {
    reasons.push(`Same tempo (${anchor.tempoBpm} BPM)`);
  } else if (scores.tempo >= 0.75) {
    reasons.push(`Similar tempo (${anchor.tempoBpm} → ${candidate.tempoBpm} BPM)`);
  } else if (scores.tempo <= 0.3) {
    reasons.push(`Big tempo shift (${anchor.tempoBpm} → ${candidate.tempoBpm} BPM)`);
  }

  // Meter
  if (scores.meter === 1.0) {
    reasons.push(`Same time signature (${anchor.timeSignature})`);
  } else if (scores.meter >= 0.7) {
    reasons.push(`Compatible meters (${anchor.timeSignature} → ${candidate.timeSignature})`);
  } else if (scores.meter >= 0.4) {
    reasons.push(`Time signature change (${anchor.timeSignature} → ${candidate.timeSignature})`);
  } else {
    reasons.push(`Incompatible time signatures (${anchor.timeSignature} → ${candidate.timeSignature})`);
  }

  // Themes
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
      const k  = keyScore(anchor.keyNumber, anchor.keySignature, candidate.keyNumber, candidate.keySignature);
      const t  = tempoScore(anchor.tempoBpm, candidate.tempoBpm);
      const m  = meterScore(anchor.timeSignature, anchor.tempoBpm, candidate.timeSignature, candidate.tempoBpm);
      const th = themeScore(anchor.themes, candidate.themes);

      const total =
        k  * WEIGHTS.key   +
        t  * WEIGHTS.tempo +
        m  * WEIGHTS.meter +
        th * WEIGHTS.theme;

      const breakdown = { key: k, tempo: t, meter: m, theme: th };
      const reasons = buildReasons(anchor, candidate, breakdown);

      return { song: candidate, total, breakdown, reasons };
    })
    .sort((a, b) => b.total - a.total);
}
