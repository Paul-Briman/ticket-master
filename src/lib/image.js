export function categoryImg(tags, { w = 800, h = 600, lock = 1 } = {}) {
  const cleaned = tags.replace(/\s+/g, '')
  return `https://loremflickr.com/${w}/${h}/${cleaned}?lock=${lock}`
}

export const CATEGORY_TAGS = {
  sports: 'stadium,soccer,football,worldcup',
  concerts: 'concert,stage,music,liveband',
  arts: 'theater,broadway,opera,stage',
  family: 'themepark,disney,carnival,family',
}

export const CITY_TAGS = {
  'new-york': 'newyork,manhattan,timessquare',
  'los-angeles': 'losangeles,hollywood,california',
  chicago: 'chicago,skyline,illinois',
  houston: 'houston,texas,skyline',
  miami: 'miami,florida,beach',
  atlanta: 'atlanta,georgia,skyline',
  'las-vegas': 'lasvegas,nevada,strip',
  'san-francisco': 'sanfrancisco,goldengate,california',
  dallas: 'dallas,texas,skyline',
  seattle: 'seattle,washington,spaceneedle',
  boston: 'boston,massachusetts,skyline',
  'washington-dc': 'washingtondc,capitol,monument',
  denver: 'denver,colorado,mountains',
  phoenix: 'phoenix,arizona,desert',
  'san-diego': 'sandiego,california,coast',
  orlando: 'orlando,florida,park',
  london: 'london,bigben,uk',
  paris: 'paris,eiffel,france',
  berlin: 'berlin,brandenburg,germany',
  toronto: 'toronto,ontario,canada',
  dubai: 'dubai,burjkhalifa,uae',
  lagos: 'lagos,nigeria,city',
  tokyo: 'tokyo,shibuya,japan',
  sydney: 'sydney,operahouse,australia',
  johannesburg: 'johannesburg,southafrica,city',
}
