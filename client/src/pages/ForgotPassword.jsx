import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Input from '../components/Input.jsx'
import Button from '../components/Button.jsx'
import { useAuth } from '../lib/auth.jsx'

export default function ForgotPassword() {
  const { forgotPassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Please enter your email.')
      return
    }
    setSubmitting(true)
    const result = await forgotPassword({ email })
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate('/reset-password', {
      replace: true,
      state: { email: email.trim() },
    })
  }

  return (
    <div className="bg-gray-50">
      <div className="mx-auto flex max-w-md flex-col px-4 py-12 md:py-20">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-2xl font-bold text-gray-900">Forgot password</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter your email and we’ll send a 6-digit code to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? 'Sending code...' : 'Send Reset Code'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Remember your password?{' '}
            <Link
              to="/login"
              className="font-semibold text-brand hover:text-brand-dark"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
