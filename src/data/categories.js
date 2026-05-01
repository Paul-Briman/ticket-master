import { categoryImg } from '../lib/image.js'

export const CATEGORIES = {
  sports: {
    key: 'sports',
    name: 'Sports',
    title: 'Sports Events',
    subtitle: 'Explore upcoming sports events near you',
    banner: categoryImg('stadium,soccer,football,worldcup', {
      w: 1920,
      h: 700,
      lock: 21,
    }),
  },
  concerts: {
    key: 'concerts',
    name: 'Concerts',
    title: 'Live Concerts',
    subtitle: 'Catch your favorite artists on tour across the U.S.',
    banner: categoryImg('concert,stage,music,liveband', {
      w: 1920,
      h: 700,
      lock: 14,
    }),
  },
  arts: {
    key: 'arts',
    name: 'Arts & Theater',
    title: 'Arts & Theater',
    subtitle: 'Broadway, ballet, opera, and stage productions near you',
    banner: categoryImg('theater,broadway,opera,stage', {
      w: 1920,
      h: 700,
      lock: 18,
    }),
  },
  family: {
    key: 'family',
    name: 'Family',
    title: 'Family Events',
    subtitle: 'Theme parks, kid-friendly shows, and family-fun experiences',
    banner: categoryImg('themepark,carnival,family,kids', {
      w: 1920,
      h: 700,
      lock: 9,
    }),
  },
}
