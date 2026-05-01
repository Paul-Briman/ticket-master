import { useParams } from 'react-router-dom'

export default function EventDetails() {
  const { id } = useParams()

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-900">Event Details</h1>
      <p className="mt-2 text-gray-600">Event ID: {id}</p>
    </section>
  )
}
