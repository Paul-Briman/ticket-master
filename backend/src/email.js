import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM || 'ticketmaster <onboarding@resend.dev>'

const resend = apiKey ? new Resend(apiKey) : null

export async function sendEmail({ to, subject, html, text }) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping send. subject="${subject}" to=${to}`,
    )
    return { skipped: true }
  }

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
    text,
  })

  if (error) {
    console.error('[email] send failed:', error)
    const err = new Error(error.message || 'Failed to send email')
    err.status = 502
    throw err
  }

  return data
}
