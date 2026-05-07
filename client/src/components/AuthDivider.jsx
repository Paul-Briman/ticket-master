export default function AuthDivider({ children = 'or' }) {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-gray-200" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {children}
        </span>
      </div>
    </div>
  )
}
