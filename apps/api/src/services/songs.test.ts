import { findAndAddSong } from './songs';

async function main() {
  console.log('Adding song to database...');

  const result = await findAndAddSong(
    'Goodness of God',
    'Bethel Music',
    'Bethel',
    {
      keySignature:     'G',
      keyNumber:        7,
      tempoBpm:         68,
      timeSignature:    '4/4',
      energyLevel:      2,
      themes:           ['faithfulness', 'testimony', 'goodness'],
      theologicalDepth: 2,
      style:            'modern',
      isHymn:           false,
    }
  );

  console.log('Song added:', JSON.stringify(result, null, 2));
}

main().catch(console.error);