import { findAndAddSong } from './songs';

async function main() {
  const songs = [
    {
      title: 'What A Beautiful Name', artist: 'Hillsong Worship', label: 'Hillsong',
      overrides: { keySignature: 'G', keyNumber: 7, tempoBpm: 72, timeSignature: '4/4', energyLevel: 2, themes: ['adoration', 'sovereignty', 'goodness'], theologicalDepth: 2, style: 'modern' as const }
    },
    {
      title: 'Oceans', artist: 'Hillsong United', label: 'Hillsong',
      overrides: { keySignature: 'D', keyNumber: 2, tempoBpm: 68, timeSignature: '4/4', energyLevel: 2, themes: ['trust', 'faith', 'surrender'], theologicalDepth: 2, style: 'modern' as const }
    },
    {
      title: 'Graves Into Gardens', artist: 'Elevation Worship', label: 'Elevation',
      overrides: { keySignature: 'B', keyNumber: 11, tempoBpm: 72, timeSignature: '4/4', energyLevel: 3, themes: ['resurrection', 'hope', 'victory'], theologicalDepth: 2, style: 'modern' as const }
    },
    {
      title: 'O Come to the Altar', artist: 'Elevation Worship', label: 'Elevation',
      overrides: { keySignature: 'A', keyNumber: 9, tempoBpm: 56, timeSignature: '4/4', energyLevel: 1, themes: ['surrender', 'grace', 'salvation'], theologicalDepth: 2, style: 'modern' as const }
    },
    {
      title: 'Way Maker', artist: 'Leeland', label: 'Bethel',
      overrides: { keySignature: 'G', keyNumber: 7, tempoBpm: 80, timeSignature: '4/4', energyLevel: 3, themes: ['faithfulness', 'Holy Spirit', 'worship'], theologicalDepth: 1, style: 'modern' as const }
    },
  ];

  for (const song of songs) {
    try {
      const result = await findAndAddSong(song.title, song.artist, song.label, song.overrides);
      console.log(`✓ Added: ${result.title}`);
    } catch (err: any) {
      console.log(`✗ Failed: ${song.title} — ${err.message}`);
    }
  }
}

main().catch(console.error);