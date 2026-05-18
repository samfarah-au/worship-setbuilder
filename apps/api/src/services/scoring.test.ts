import { scoreSongs, SongForScoring } from './scoring';

const anchor: SongForScoring = {
  id:            '1',
  title:         'Goodness of God',
  artist:        'Bethel Music',
  keyNumber:     7,
  keySignature:  'G',
  tempoBpm:      68,
  timeSignature: '4/4',
  energyLevel:   2,
  themes:        ['faithfulness', 'testimony', 'goodness'],
};

const candidates: SongForScoring[] = [
  {
    id:            '2',
    title:         'What A Beautiful Name',
    artist:        'Hillsong Worship',
    keyNumber:     7,   // G - same key
    keySignature:  'G',
    tempoBpm:      72,
    timeSignature: '4/4',
    energyLevel:   2,
    themes:        ['adoration', 'sovereignty', 'goodness'],
  },
  {
    id:            '3',
    title:         'Great Are You Lord',
    artist:        'All Sons & Daughters',
    keyNumber:     7,   // G - same key
    keySignature:  'G',
    tempoBpm:      68,
    timeSignature: '6/8',
    energyLevel:   2,
    themes:        ['worship', 'faithfulness', 'testimony'],
  },
  {
    id:            '4',
    title:         'This Is Amazing Grace',
    artist:        'Phil Wickham',
    keyNumber:     7,   // G
    keySignature:  'G',
    tempoBpm:      138,
    timeSignature: '4/4',
    energyLevel:   5,
    themes:        ['grace', 'salvation'],
  },
  {
    id:            '5',
    title:         'Tremble',
    artist:        'Elevation Worship',
    keyNumber:     4,   // E
    keySignature:  'E',
    tempoBpm:      65,
    timeSignature: '4/4',
    energyLevel:   2,
    themes:        ['surrender', 'Holy Spirit'],
  },
];

const results = scoreSongs(anchor, candidates);

results.forEach(r => {
  console.log(`\n${r.song.title} — ${Math.round(r.total * 100)}%`);
  console.log(`  Key: ${Math.round(r.breakdown.key * 100)}% | Tempo: ${Math.round(r.breakdown.tempo * 100)}% | Meter: ${Math.round(r.breakdown.meter * 100)}% | Energy: ${Math.round(r.breakdown.energy * 100)}% | Theme: ${Math.round(r.breakdown.theme * 100)}%`);
  r.reasons.forEach(reason => console.log(`  → ${reason}`));
});