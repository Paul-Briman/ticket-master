import { categoryImg, CITY_TAGS } from '../lib/image.js'

function cityImg(slug, lock = 5) {
  return categoryImg(CITY_TAGS[slug] || slug, { w: 800, h: 500, lock })
}

export const POPULAR_US_CITIES = [
  { name: 'New York', slug: 'new-york', eventCount: 720, image: cityImg('new-york', 1) },
  { name: 'Los Angeles', slug: 'los-angeles', eventCount: 612, image: cityImg('los-angeles', 2) },
  { name: 'Chicago', slug: 'chicago', eventCount: 480, image: cityImg('chicago', 3) },
  { name: 'Houston', slug: 'houston', eventCount: 355, image: cityImg('houston', 4) },
  { name: 'Miami', slug: 'miami', eventCount: 412, image: cityImg('miami', 5) },
  { name: 'Atlanta', slug: 'atlanta', eventCount: 388, image: cityImg('atlanta', 6) },
  { name: 'Las Vegas', slug: 'las-vegas', eventCount: 540, image: cityImg('las-vegas', 7) },
  { name: 'San Francisco', slug: 'san-francisco', eventCount: 430, image: cityImg('san-francisco', 8) },
]

export const ALL_US_CITIES = [
  { name: 'Atlanta', slug: 'atlanta' },
  { name: 'Boston', slug: 'boston' },
  { name: 'Charlotte', slug: 'charlotte' },
  { name: 'Chicago', slug: 'chicago' },
  { name: 'Dallas', slug: 'dallas' },
  { name: 'Denver', slug: 'denver' },
  { name: 'Detroit', slug: 'detroit' },
  { name: 'Houston', slug: 'houston' },
  { name: 'Las Vegas', slug: 'las-vegas' },
  { name: 'Los Angeles', slug: 'los-angeles' },
  { name: 'Miami', slug: 'miami' },
  { name: 'Minneapolis', slug: 'minneapolis' },
  { name: 'Nashville', slug: 'nashville' },
  { name: 'New Orleans', slug: 'new-orleans' },
  { name: 'New York', slug: 'new-york' },
  { name: 'Orlando', slug: 'orlando' },
  { name: 'Philadelphia', slug: 'philadelphia' },
  { name: 'Phoenix', slug: 'phoenix' },
  { name: 'Portland', slug: 'portland' },
  { name: 'San Diego', slug: 'san-diego' },
  { name: 'San Francisco', slug: 'san-francisco' },
  { name: 'Seattle', slug: 'seattle' },
  { name: 'St. Louis', slug: 'st-louis' },
  { name: 'Washington DC', slug: 'washington-dc' },
]

export const WORLDWIDE_CITIES = [
  { name: 'Berlin', slug: 'berlin', country: 'Germany' },
  { name: 'Dubai', slug: 'dubai', country: 'UAE' },
  { name: 'Johannesburg', slug: 'johannesburg', country: 'South Africa' },
  { name: 'Lagos', slug: 'lagos', country: 'Nigeria' },
  { name: 'London', slug: 'london', country: 'United Kingdom' },
  { name: 'Mexico City', slug: 'mexico-city', country: 'Mexico' },
  { name: 'Paris', slug: 'paris', country: 'France' },
  { name: 'Sao Paulo', slug: 'sao-paulo', country: 'Brazil' },
  { name: 'Sydney', slug: 'sydney', country: 'Australia' },
  { name: 'Tokyo', slug: 'tokyo', country: 'Japan' },
  { name: 'Toronto', slug: 'toronto', country: 'Canada' },
]
