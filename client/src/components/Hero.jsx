import Button from './Button.jsx'

const HERO_IMAGE =
  'https://library.sportingnews.com/styles/crop_style_16_9_desktop_webp/s3/2025-11/World-Cup-2026-umbrella-FTR-%281%29.jpg.webp?itok=XaOY3f1S'

export default function Hero() {
  return (
    <section
      className="relative isolate w-full bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('${HERO_IMAGE}')` }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/55 to-black/40" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-brand/70 to-transparent" />

      <div className="relative mx-auto flex min-h-[55vh] max-w-7xl flex-col items-center justify-center px-4 py-16 text-center md:min-h-[65vh] md:px-6 md:py-24">
        <span className="mb-4 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
          Official Tickets
        </span>

        <h1 className="text-3xl font-bold leading-tight text-white drop-shadow-md md:text-5xl">
          FIFA World Cup Tickets
        </h1>
        <p className="mt-3 max-w-xl text-base text-gray-100 drop-shadow md:text-lg">
          Secure your seat for the biggest matches of the year.
        </p>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="mt-8 flex w-full max-w-xl items-center gap-2 rounded-lg bg-white p-1.5 shadow-lg"
        >
          <input
            type="text"
            placeholder="Search teams, artists, venues..."
            className="flex-1 rounded-md border-0 bg-transparent px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
          />
          <Button type="submit" size="md">
            Search
          </Button>
        </form>

        <div className="mt-6">
          <Button variant="secondary" size="lg" className="bg-white/95">
            Browse Matches
          </Button>
        </div>
      </div>
    </section>
  )
}
