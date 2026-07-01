import Image from './Image.jsx'

export default function CategoryHeader({ title, subtitle, image }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Image
          src={image}
          alt={title}
          className="h-full w-full object-cover"
          // LCP element on every category landing page — prioritize
          // so the hero paints before the event grid populates.
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/30" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <h1 className="text-3xl font-bold leading-tight text-white md:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-base text-gray-100 md:text-lg">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  )
}
