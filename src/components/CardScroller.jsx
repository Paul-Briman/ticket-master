export default function CardScroller({ children }) {
  return (
    <div className="-mx-4 px-4 md:mx-0 md:px-0">
      <div className="hidden gap-5 md:grid md:grid-cols-3 lg:grid-cols-4">
        {children}
      </div>

      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {Array.isArray(children)
          ? children.map((child, i) => (
              <div
                key={i}
                className="w-[80%] shrink-0 snap-start sm:w-[55%]"
              >
                {child}
              </div>
            ))
          : (
            <div className="w-[80%] shrink-0 snap-start sm:w-[55%]">
              {children}
            </div>
          )}
      </div>
    </div>
  )
}
