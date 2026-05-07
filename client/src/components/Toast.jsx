import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const ToastContext = createContext(null)

const STYLES = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
}

const ICONS = {
  success: '✓',
  error: '✕',
  info: 'i',
  warning: '!',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (message, opts = {}) => {
      const id = ++idRef.current
      const type = opts.type || 'success'
      const duration = opts.duration ?? 3500
      setToasts((prev) => [...prev, { id, message, type }])
      if (duration > 0) {
        setTimeout(() => remove(id), duration)
      }
      return id
    },
    [remove],
  )

  return (
    <ToastContext.Provider value={{ toast, remove }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 md:top-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm font-medium shadow-md transition-all duration-200 animate-[tmToastIn_0.25s_ease-out] ${STYLES[t.type] || STYLES.info}`}
            style={{ minWidth: 240, maxWidth: 460 }}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold ring-1 ring-current"
              aria-hidden
            >
              {ICONS[t.type] || ICONS.info}
            </span>
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
              className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      toast: () => {},
      remove: () => {},
    }
  }
  return ctx
}
