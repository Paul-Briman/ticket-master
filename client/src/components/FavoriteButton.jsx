import { useNavigate } from 'react-router-dom'
import { useFavorites } from '../lib/favorites.js'
import { useToast } from './Toast.jsx'

const HeartIcon = ({ filled, size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21l8.84-8.61a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

export default function FavoriteButton({
  event,
  // Legacy shorthand props — still supported. Prefer passing the
  // full `event` object so we can render the favorite without
  // looking it up against any catalog.
  eventId,
  eventTitle,
  variant = 'overlay',
  className = '',
}) {
  const { isFavorite, toggleFavorite, canFavorite } = useFavorites()
  const { toast } = useToast()
  const navigate = useNavigate()
  const id = event?.id || eventId
  const title = event?.title || eventTitle
  const active = canFavorite && id && isFavorite(id)

  function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!canFavorite) {
      toast('Log in to save events to your favorites.', { type: 'info' })
      navigate('/login', { state: { from: window.location.pathname } })
      return
    }
    if (!id) return
    const payload = event || { id, title }
    const added = toggleFavorite(payload)
    toast(
      added
        ? `Saved${title ? ` "${title}"` : ''} to your favorites`
        : 'Removed from favorites',
      { type: added ? 'success' : 'info' },
    )
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={active ? 'Remove from favorites' : 'Save to favorites'}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
          active
            ? 'border-red-200 bg-red-50 text-red-600'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
        } ${className}`}
      >
        <HeartIcon filled={active} />
        <span>{active ? 'Saved' : 'Save'}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={active ? 'Remove from favorites' : 'Save to favorites'}
      className={`group/fav absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm backdrop-blur transition-all duration-200 hover:scale-110 hover:bg-white ${
        active ? 'text-red-500' : 'hover:text-red-500'
      } ${className}`}
    >
      <HeartIcon filled={active} />
    </button>
  )
}
