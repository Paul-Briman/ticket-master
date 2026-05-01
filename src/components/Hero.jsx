import Button from './Button.jsx'

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img
          src="https://picsum.photos/seed/stadium-crowd/1920/900"
          alt="Stadium crowd"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/55 to-black/30" />
      </div>

      <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-20 text-center md:px-6 md:py-28">
        <span className="mb-4 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
          Official Tickets
        </span>

        <h1 className="text-3xl font-bold leading-tight text-white md:text-5xl">
          FIFA World Cup Tickets
        </h1>
        <p className="mt-3 max-w-xl text-base text-gray-100 md:text-lg">
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
