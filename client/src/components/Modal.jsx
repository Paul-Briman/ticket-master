import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex w-full max-w-lg flex-col rounded-lg border border-gray-200 bg-white shadow-xl"
      >
        {title && (
          <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path
                  fillRule="evenodd"
                  d="M4.21 4.21a.75.75 0 011.06 0L10 8.94l4.73-4.73a.75.75 0 111.06 1.06L11.06 10l4.73 4.73a.75.75 0 11-1.06 1.06L10 11.06l-4.73 4.73a.75.75 0 01-1.06-1.06L8.94 10 4.21 5.27a.75.75 0 010-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </header>
        )}

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
