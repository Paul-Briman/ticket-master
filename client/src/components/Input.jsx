import { forwardRef, useId } from 'react'

const Input = forwardRef(function Input(
  { label, error, id, className = '', type = 'text', ...rest },
  ref,
) {
  const reactId = useId()
  const inputId = id || reactId

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        ref={ref}
        type={type}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 ${
          error
            ? 'border-red-400 focus:border-red-500'
            : 'border-gray-300 focus:border-brand'
        }`}
        {...rest}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
})

export default Input
