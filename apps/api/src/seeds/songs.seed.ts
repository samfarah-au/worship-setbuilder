import type { NewSong } from '../services/songs'

type SeedSong = Omit<NewSong, 'spotifyTrackId'> & {
  searchTitle: string
  searchArtist: string
}

export const SEED_SONGS: SeedSong[] = [
  // ── ELEVATION ──────────────────────────────────────────────
  {
    searchTitle: 'What A Beautiful Name', searchArtist: 'Hillsong Worship',
    title: 'What A Beautiful Name', artist: 'Hillsong Worship', sourceLabel: 'Hillsong',
    keySignature: 'G', keyNumber: 7, tempoBpm: 72, timeSignature: '4/4', energyLevel: 2,
    themes: ['adoration', 'sovereignty', 'salvation', 'Jesus'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Oceans', searchArtist: 'Hillsong United',
    title: 'Oceans (Where Feet May Fail)', artist: 'Hillsong United', sourceLabel: 'Hillsong',
    keySignature: 'D', keyNumber: 2, tempoBpm: 68, timeSignature: '4/4', energyLevel: 2,
    themes: ['trust', 'faith', 'surrender', 'Holy Spirit'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Cornerstone', searchArtist: 'Hillsong Worship',
    title: 'Cornerstone', artist: 'Hillsong Worship', sourceLabel: 'Hillsong',
    keySignature: 'C', keyNumber: 0, tempoBpm: 72, timeSignature: '4/4', energyLevel: 2,
    themes: ['trust', 'salvation', 'grace', 'Jesus'], theologicalDepth: 3, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Mighty to Save', searchArtist: 'Hillsong Worship',
    title: 'Mighty to Save', artist: 'Hillsong Worship', sourceLabel: 'Hillsong',
    keySignature: 'A', keyNumber: 9, tempoBpm: 76, timeSignature: '4/4', energyLevel: 3,
    themes: ['salvation', 'hope', 'Jesus', 'victory'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Forever Reign', searchArtist: 'Hillsong Worship',
    title: 'Forever Reign', artist: 'Hillsong Worship', sourceLabel: 'Hillsong',
    keySignature: 'G', keyNumber: 7, tempoBpm: 132, timeSignature: '4/4', energyLevel: 4,
    themes: ['worship', 'sovereignty', 'Jesus', 'adoration'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Man of Sorrows', searchArtist: 'Hillsong Worship',
    title: 'Man of Sorrows', artist: 'Hillsong Worship', sourceLabel: 'Hillsong',
    keySignature: 'B', keyNumber: 11, tempoBpm: 68, timeSignature: '4/4', energyLevel: 2,
    themes: ['cross', 'salvation', 'Jesus', 'grace'], theologicalDepth: 3, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Touch of Heaven', searchArtist: 'Hillsong Worship',
    title: 'Touch of Heaven', artist: 'Hillsong Worship', sourceLabel: 'Hillsong',
    keySignature: 'G', keyNumber: 7, tempoBpm: 70, timeSignature: '4/4', energyLevel: 2,
    themes: ['Holy Spirit', 'worship', 'surrender', 'revival'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'So Will I', searchArtist: 'Hillsong United',
    title: 'So Will I (100 Billion X)', artist: 'Hillsong United', sourceLabel: 'Hillsong',
    keySignature: 'A', keyNumber: 9, tempoBpm: 73, timeSignature: '4/4', energyLevel: 3,
    themes: ['creation', 'worship', 'adoration', 'Jesus'], theologicalDepth: 3, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Take Heart', searchArtist: 'Hillsong United',
    title: 'Take Heart', artist: 'Hillsong United', sourceLabel: 'Hillsong',
    keySignature: 'E', keyNumber: 4, tempoBpm: 138, timeSignature: '4/4', energyLevel: 4,
    themes: ['hope', 'faith', 'trust', 'victory'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'King of Kings', searchArtist: 'Hillsong Worship',
    title: 'King of Kings', artist: 'Hillsong Worship', sourceLabel: 'Hillsong',
    keySignature: 'G', keyNumber: 7, tempoBpm: 68, timeSignature: '4/4', energyLevel: 2,
    themes: ['Jesus', 'salvation', 'resurrection', 'sovereignty'], theologicalDepth: 3, style: 'modern', isHymn: false,
  },

  // ── BETHEL ─────────────────────────────────────────────────
  {
    searchTitle: 'Goodness of God', searchArtist: 'Bethel Music',
    title: 'Goodness of God', artist: 'Bethel Music', sourceLabel: 'Bethel',
    keySignature: 'G', keyNumber: 7, tempoBpm: 68, timeSignature: '4/4', energyLevel: 2,
    themes: ['faithfulness', 'testimony', 'goodness', 'grace'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Reckless Love', searchArtist: 'Cory Asbury',
    title: 'Reckless Love', artist: 'Cory Asbury', sourceLabel: 'Bethel',
    keySignature: 'E', keyNumber: 4, tempoBpm: 68, timeSignature: '4/4', energyLevel: 2,
    themes: ['love', 'grace', 'pursuit', 'salvation'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Way Maker', searchArtist: 'Leeland',
    title: 'Way Maker', artist: 'Leeland', sourceLabel: 'Bethel',
    keySignature: 'G', keyNumber: 7, tempoBpm: 80, timeSignature: '4/4', energyLevel: 3,
    themes: ['faithfulness', 'Holy Spirit', 'worship', 'miracle'], theologicalDepth: 1, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Victory', searchArtist: 'Bethel Music',
    title: 'Victory', artist: 'Bethel Music', sourceLabel: 'Bethel',
    keySignature: 'B', keyNumber: 11, tempoBpm: 140, timeSignature: '4/4', energyLevel: 5,
    themes: ['victory', 'resurrection', 'hope', 'Jesus'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Living Hope', searchArtist: 'Phil Wickham',
    title: 'Living Hope', artist: 'Phil Wickham', sourceLabel: 'Bethel',
    keySignature: 'G', keyNumber: 7, tempoBpm: 138, timeSignature: '4/4', energyLevel: 4,
    themes: ['resurrection', 'hope', 'Jesus', 'salvation'], theologicalDepth: 3, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Raise a Hallelujah', searchArtist: 'Bethel Music',
    title: 'Raise a Hallelujah', artist: 'Bethel Music', sourceLabel: 'Bethel',
    keySignature: 'G', keyNumber: 7, tempoBpm: 126, timeSignature: '4/4', energyLevel: 4,
    themes: ['worship', 'victory', 'praise', 'faith'], theologicalDepth: 1, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'No Longer Slaves', searchArtist: 'Bethel Music',
    title: 'No Longer Slaves', artist: 'Bethel Music', sourceLabel: 'Bethel',
    keySignature: 'A', keyNumber: 9, tempoBpm: 71, timeSignature: '4/4', energyLevel: 3,
    themes: ['freedom', 'identity', 'love', 'Holy Spirit'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Ever Be', searchArtist: 'Bethel Music',
    title: 'Ever Be', artist: 'Bethel Music', sourceLabel: 'Bethel',
    keySignature: 'E', keyNumber: 4, tempoBpm: 68, timeSignature: '4/4', energyLevel: 2,
    themes: ['faithfulness', 'worship', 'adoration', 'goodness'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'You Make Me Brave', searchArtist: 'Bethel Music',
    title: 'You Make Me Brave', artist: 'Bethel Music', sourceLabel: 'Bethel',
    keySignature: 'D', keyNumber: 2, tempoBpm: 140, timeSignature: '4/4', energyLevel: 4,
    themes: ['faith', 'courage', 'Holy Spirit', 'surrender'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Shepherd', searchArtist: 'Bethel Music',
    title: 'Shepherd', artist: 'Bethel Music', sourceLabel: 'Bethel',
    keySignature: 'C', keyNumber: 0, tempoBpm: 64, timeSignature: '4/4', energyLevel: 1,
    themes: ['trust', 'peace', 'goodness', 'faithfulness'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },

  // ── ELEVATION ──────────────────────────────────────────────
  {
    searchTitle: 'Graves Into Gardens', searchArtist: 'Elevation Worship',
    title: 'Graves Into Gardens', artist: 'Elevation Worship', sourceLabel: 'Elevation',
    keySignature: 'B', keyNumber: 11, tempoBpm: 72, timeSignature: '4/4', energyLevel: 3,
    themes: ['resurrection', 'hope', 'victory', 'Jesus'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'O Come to the Altar', searchArtist: 'Elevation Worship',
    title: 'O Come to the Altar', artist: 'Elevation Worship', sourceLabel: 'Elevation',
    keySignature: 'A', keyNumber: 9, tempoBpm: 56, timeSignature: '4/4', energyLevel: 1,
    themes: ['surrender', 'grace', 'salvation', 'cross'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Do It Again', searchArtist: 'Elevation Worship',
    title: 'Do It Again', artist: 'Elevation Worship', sourceLabel: 'Elevation',
    keySignature: 'B', keyNumber: 11, tempoBpm: 70, timeSignature: '4/4', energyLevel: 2,
    themes: ['faithfulness', 'testimony', 'trust', 'miracle'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'See A Victory', searchArtist: 'Elevation Worship',
    title: 'See A Victory', artist: 'Elevation Worship', sourceLabel: 'Elevation',
    keySignature: 'G', keyNumber: 7, tempoBpm: 138, timeSignature: '4/4', energyLevel: 5,
    themes: ['victory', 'faith', 'hope', 'praise'], theologicalDepth: 1, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Praise', searchArtist: 'Elevation Worship',
    title: 'Praise', artist: 'Elevation Worship', sourceLabel: 'Elevation',
    keySignature: 'G', keyNumber: 7, tempoBpm: 145, timeSignature: '4/4', energyLevel: 5,
    themes: ['praise', 'worship', 'victory', 'adoration'], theologicalDepth: 1, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Joyful Joyful', searchArtist: 'Elevation Worship',
    title: 'Joyful Joyful', artist: 'Elevation Worship', sourceLabel: 'Elevation',
    keySignature: 'D', keyNumber: 2, tempoBpm: 132, timeSignature: '4/4', energyLevel: 4,
    themes: ['joy', 'praise', 'worship', 'adoration'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'There is a Cloud', searchArtist: 'Elevation Worship',
    title: 'There is a Cloud', artist: 'Elevation Worship', sourceLabel: 'Elevation',
    keySignature: 'E', keyNumber: 4, tempoBpm: 72, timeSignature: '4/4', energyLevel: 3,
    themes: ['Holy Spirit', 'revival', 'worship', 'faith'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Hallelujah Here Below', searchArtist: 'Elevation Worship',
    title: 'Hallelujah Here Below', artist: 'Elevation Worship', sourceLabel: 'Elevation',
    keySignature: 'A', keyNumber: 9, tempoBpm: 68, timeSignature: '4/4', energyLevel: 2,
    themes: ['worship', 'adoration', 'praise', 'surrender'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Worthy', searchArtist: 'Elevation Worship',
    title: 'Worthy', artist: 'Elevation Worship', sourceLabel: 'Elevation',
    keySignature: 'D', keyNumber: 2, tempoBpm: 76, timeSignature: '4/4', energyLevel: 3,
    themes: ['adoration', 'sovereignty', 'worship', 'Jesus'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'The Blessing', searchArtist: 'Elevation Worship',
    title: 'The Blessing', artist: 'Elevation Worship', sourceLabel: 'Elevation',
    keySignature: 'D', keyNumber: 2, tempoBpm: 67, timeSignature: '4/4', energyLevel: 2,
    themes: ['blessing', 'faithfulness', 'grace', 'worship'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },

  // ── PASSION ────────────────────────────────────────────────
  {
    searchTitle: 'Build My Life', searchArtist: 'Passion',
    title: 'Build My Life', artist: 'Passion', sourceLabel: 'Passion',
    keySignature: 'E', keyNumber: 4, tempoBpm: 68, timeSignature: '4/4', energyLevel: 2,
    themes: ['worship', 'surrender', 'Jesus', 'adoration'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'How Great Is Our God', searchArtist: 'Chris Tomlin',
    title: 'How Great Is Our God', artist: 'Chris Tomlin', sourceLabel: 'Passion',
    keySignature: 'G', keyNumber: 7, tempoBpm: 76, timeSignature: '4/4', energyLevel: 3,
    themes: ['adoration', 'sovereignty', 'worship', 'creation'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Good Good Father', searchArtist: 'Chris Tomlin',
    title: 'Good Good Father', artist: 'Chris Tomlin', sourceLabel: 'Passion',
    keySignature: 'G', keyNumber: 7, tempoBpm: 68, timeSignature: '4/4', energyLevel: 2,
    themes: ['love', 'identity', 'Father', 'goodness'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Holy Forever', searchArtist: 'Chris Tomlin',
    title: 'Holy Forever', artist: 'Chris Tomlin', sourceLabel: 'Passion',
    keySignature: 'G', keyNumber: 7, tempoBpm: 72, timeSignature: '4/4', energyLevel: 3,
    themes: ['holiness', 'adoration', 'sovereignty', 'worship'], theologicalDepth: 3, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Glorious Day', searchArtist: 'Passion',
    title: 'Glorious Day', artist: 'Passion', sourceLabel: 'Passion',
    keySignature: 'G', keyNumber: 7, tempoBpm: 138, timeSignature: '4/4', energyLevel: 4,
    themes: ['resurrection', 'salvation', 'Jesus', 'victory'], theologicalDepth: 3, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Christ Be All Around Me', searchArtist: 'Kristian Stanfill',
    title: 'Christ Be All Around Me', artist: 'Passion', sourceLabel: 'Passion',
    keySignature: 'C', keyNumber: 0, tempoBpm: 72, timeSignature: '4/4', energyLevel: 2,
    themes: ['Jesus', 'surrender', 'worship', 'presence'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },

  // ── PLANET SHAKERS ─────────────────────────────────────────
  {
    searchTitle: 'Your Love Never Stops', searchArtist: 'Planetshakers',
    title: 'Never Stops', artist: 'Planetshakers', sourceLabel: 'Planet Shakers',
    keySignature: 'A', keyNumber: 9, tempoBpm: 140, timeSignature: '4/4', energyLevel: 5,
    themes: ['praise', 'worship', 'love', 'adoration'], theologicalDepth: 1, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Fill Me Up God', searchArtist: 'Planetshakers',
    title: 'Fill Me Up', artist: 'Planetshakers', sourceLabel: 'Planet Shakers',
    keySignature: 'G', keyNumber: 7, tempoBpm: 136, timeSignature: '4/4', energyLevel: 4,
    themes: ['Holy Spirit', 'revival', 'worship', 'surrender'], theologicalDepth: 1, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Endless Praise', searchArtist: 'Planetshakers',
    title: 'Endless Praise', artist: 'Planetshakers', sourceLabel: 'Planet Shakers',
    keySignature: 'B', keyNumber: 11, tempoBpm: 142, timeSignature: '4/4', energyLevel: 5,
    themes: ['praise', 'worship', 'adoration', 'victory'], theologicalDepth: 1, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Nothing Is Impossible', searchArtist: 'Planetshakers',
    title: 'Nothing Is Impossible', artist: 'Planetshakers', sourceLabel: 'Planet Shakers',
    keySignature: 'D', keyNumber: 2, tempoBpm: 138, timeSignature: '4/4', energyLevel: 4,
    themes: ['faith', 'miracle', 'hope', 'victory'], theologicalDepth: 1, style: 'modern', isHymn: false,
  },

  // ── THE BELONGING CO ───────────────────────────────────────
  {
    searchTitle: 'Death Was Arrested', searchArtist: 'North Point InsideOut',
    title: 'Death Was Arrested', artist: 'North Point InsideOut', sourceLabel: 'Belonging Co',
    keySignature: 'E', keyNumber: 4, tempoBpm: 72, timeSignature: '4/4', energyLevel: 3,
    themes: ['resurrection', 'salvation', 'Jesus', 'grace'], theologicalDepth: 3, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Here Again', searchArtist: 'Elevation Worship',
    title: 'Here Again', artist: 'Elevation Worship', sourceLabel: 'Belonging Co',
    keySignature: 'G', keyNumber: 7, tempoBpm: 66, timeSignature: '4/4', energyLevel: 2,
    themes: ['faithfulness', 'trust', 'presence', 'surrender'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },

  // ── JESUS CULTURE ──────────────────────────────────────────
  {
    searchTitle: 'One Thing Remains', searchArtist: 'Jesus Culture',
    title: 'One Thing Remains', artist: 'Jesus Culture', sourceLabel: 'Jesus Culture',
    keySignature: 'E', keyNumber: 4, tempoBpm: 68, timeSignature: '4/4', energyLevel: 2,
    themes: ['love', 'faithfulness', 'grace', 'worship'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Your Love Never Fails', searchArtist: 'Jesus Culture',
    title: 'Your Love Never Fails', artist: 'Jesus Culture', sourceLabel: 'Jesus Culture',
    keySignature: 'A', keyNumber: 9, tempoBpm: 132, timeSignature: '4/4', energyLevel: 4,
    themes: ['love', 'faithfulness', 'hope', 'worship'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Holy Spirit', searchArtist: 'Jesus Culture',
    title: 'Holy Spirit', artist: 'Jesus Culture', sourceLabel: 'Jesus Culture',
    keySignature: 'D', keyNumber: 2, tempoBpm: 64, timeSignature: '4/4', energyLevel: 1,
    themes: ['Holy Spirit', 'presence', 'surrender', 'worship'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Come As You Are', searchArtist: 'Crowder',
    title: 'Come As You Are', artist: 'Crowder', sourceLabel: 'Jesus Culture',
    keySignature: 'G', keyNumber: 7, tempoBpm: 76, timeSignature: '4/4', energyLevel: 2,
    themes: ['grace', 'salvation', 'surrender', 'love'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },

  // ── HYMNS ──────────────────────────────────────────────────
  {
    searchTitle: 'Great Are You Lord', searchArtist: 'All Sons and Daughters',
    title: 'Great Are You Lord', artist: 'All Sons & Daughters', sourceLabel: 'Bethel',
    keySignature: 'G', keyNumber: 7, tempoBpm: 68, timeSignature: '6/8', energyLevel: 2,
    themes: ['worship', 'adoration', 'sovereignty', 'creation'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Turn Your Eyes Upon Jesus', searchArtist: 'Helen Lemmel',
    title: 'Turn Your Eyes Upon Jesus', artist: 'Sovereign Grace Music', sourceLabel: 'Hillsong',
    keySignature: 'G', keyNumber: 7, tempoBpm: 65, timeSignature: '3/4', energyLevel: 1,
    themes: ['Jesus', 'surrender', 'grace', 'salvation'], theologicalDepth: 3, style: 'hymn', isHymn: true,
  },
  {
    searchTitle: 'Be Thou My Vision', searchArtist: 'Audrey Assad',
    title: 'Be Thou My Vision', artist: 'Audrey Assad', sourceLabel: 'Bethel',
    keySignature: 'D', keyNumber: 2, tempoBpm: 104, timeSignature: '3/4', energyLevel: 2,
    themes: ['surrender', 'Jesus', 'trust', 'worship'], theologicalDepth: 3, style: 'hymn', isHymn: true,
  },
  {
    searchTitle: 'It Is Well', searchArtist: 'Bethel Music',
    title: 'It Is Well', artist: 'Bethel Music', sourceLabel: 'Bethel',
    keySignature: 'G', keyNumber: 7, tempoBpm: 68, timeSignature: '4/4', energyLevel: 2,
    themes: ['peace', 'trust', 'salvation', 'grace'], theologicalDepth: 3, style: 'hymn', isHymn: true,
  },
  {
    searchTitle: 'How Great Thou Art', searchArtist: 'Carrie Underwood',
    title: 'How Great Thou Art', artist: 'Traditional', sourceLabel: 'Hillsong',
    keySignature: 'Bb', keyNumber: 10, tempoBpm: 76, timeSignature: '3/4', energyLevel: 3,
    themes: ['adoration', 'creation', 'sovereignty', 'worship'], theologicalDepth: 3, style: 'hymn', isHymn: true,
  },
  {
    searchTitle: 'Amazing Grace My Chains Are Gone', searchArtist: 'Chris Tomlin',
    title: 'Amazing Grace (My Chains Are Gone)', artist: 'Chris Tomlin', sourceLabel: 'Passion',
    keySignature: 'G', keyNumber: 7, tempoBpm: 68, timeSignature: '3/4', energyLevel: 2,
    themes: ['grace', 'salvation', 'freedom', 'Jesus'], theologicalDepth: 3, style: 'hymn', isHymn: true,
  },
  {
    searchTitle: 'This Is Amazing Grace', searchArtist: 'Phil Wickham',
    title: 'This Is Amazing Grace', artist: 'Phil Wickham', sourceLabel: 'Passion',
    keySignature: 'G', keyNumber: 7, tempoBpm: 138, timeSignature: '4/4', energyLevel: 4,
    themes: ['grace', 'salvation', 'Jesus', 'worship'], theologicalDepth: 2, style: 'modern', isHymn: false,
  },
  {
    searchTitle: 'Great Is Thy Faithfulness', searchArtist: 'Shane and Shane',
    title: 'Great Is Thy Faithfulness', artist: 'Shane & Shane', sourceLabel: 'Bethel',
    keySignature: 'D', keyNumber: 2, tempoBpm: 72, timeSignature: '3/4', energyLevel: 2,
    themes: ['faithfulness', 'goodness', 'worship', 'trust'], theologicalDepth: 3, style: 'hymn', isHymn: true,
  },
]