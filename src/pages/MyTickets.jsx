import { Link } from 'react-router-dom'
import Button from '../components/Button.jsx'
import { useAuth } from '../lib/auth.jsx'

export default function MyTickets() {
  const { user } = useAuth()

  return (
    <div className="bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          My Tickets
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {user?.name ? `Welcome back, ${user.name}.` : 'Welcome.'} Your purchased tickets will appear here.
        </p>

        <div className="mt-8 rounded-lg border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <h2 className="text-base font-semibold text-gray-900">
            You don’t have any tickets yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Once you complete a purchase, your mobile tickets will show up
            right here.
          </p>
          <Link to="/" className="mt-5 inline-block">
            <Button>Browse events</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
