const VARIANTS = {
  primary:
    'bg-brand text-white border border-transparent hover:bg-brand-dark focus:ring-brand',
  secondary:
    'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 focus:ring-brand',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <button
      type={type}
      className={`${base} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
