import { getTrackMetadata, searchTrack } from './spotify';

async function main() {
  // Test 1: fetch by known Spotify ID
  console.log('--- Fetch by Track ID ---');
  const track = await getTrackMetadata('4uLU6hMCjMI75M1A2tKUQC');
  console.log(JSON.stringify(track, null, 2));

  // Test 2: search by title + artist
  console.log('\n--- Search by Title + Artist ---');
  const results = await searchTrack('Goodness of God', 'Bethel Music');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);