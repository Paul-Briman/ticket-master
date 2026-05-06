export default function EventHero({ event }) {
  const location = [event.venue, event.city, event.country]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img
          src={event.image}
          alt={event.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/30" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
        <span className="inline-block rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
          {event.category === 'concerts' ? 'Live Concert' : event.category === 'arts' ? 'Arts & Theater' : event.category === 'family' ? 'Family Event' : 'Live Sports'}
        </span>

        <h1 className="mt-4 text-3xl font-bold leading-tight text-white drop-shadow-md md:text-5xl">
          {event.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-100 md:text-base">
          {event.date && (
            <span className="flex items-center gap-2">
              <span aria-hidden>📅</span>
              {event.date}
            </span>
          )}
          {location && (
            <span className="flex items-center gap-2">
              <span aria-hidden>📍</span>
              {location}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
