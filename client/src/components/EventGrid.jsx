import EventCard from './EventCard.jsx'

export default function EventGrid({ events, emptyMessage = 'No events found.' }) {
  if (!events || events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-16 text-center text-sm text-gray-500">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {events.map((event) => (
        <EventCard key={event.id} {...event} location={event.venue ? `${event.venue}, ${event.city}` : event.city} />
      ))}
    </div>
  )
}
