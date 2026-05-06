import { Link } from 'react-router-dom'

export default function Section({
  title,
  subtitle,
  seeAllHref,
  seeAllLabel = 'See All',
  background = 'white',
  className = '',
  children,
}) {
  const bg = background === 'gray' ? 'bg-gray-50' : 'bg-white'

  return (
    <section className={`${bg} ${className}`}>
      <div className="mx-auto max-w-7xl px-6 py-10 md:py-12">
        {(title || seeAllHref) && (
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              {title && (
                <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
              )}
            </div>

            {seeAllHref && (
              <Link
                to={seeAllHref}
                className="text-sm font-medium text-brand hover:text-brand-dark"
              >
                {seeAllLabel} →
              </Link>
            )}
          </div>
        )}

        {children}
      </div>
    </section>
  )
}
