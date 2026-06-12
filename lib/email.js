import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY

// Production sender. Mailbox + visible name. The domain MUST be a
// verified Resend domain (Domains → Verified) or sends will 403.
const FROM =
  process.env.EMAIL_FROM || 'Ticketsmasterr <noreply@ticketsmasterr.com>'

// Where user replies to automated emails should land. Optional — when
// set, every outbound message includes a Reply-To header so a customer
// replying to an OTP / receipt / welcome email reaches a monitored
// inbox instead of the unattended noreply mailbox.
const REPLY_TO = process.env.SUPPORT_EMAIL || ''

const resend = apiKey ? new Resend(apiKey) : null

export async function sendEmail({ to, subject, html, text }) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping send. subject="${subject}" to=${to}`,
    )
    return { skipped: true }
  }

  const payload = {
    from: FROM,
    to,
    subject,
    html,
    text,
  }
  if (REPLY_TO) payload.reply_to = REPLY_TO

  const { data, error } = await resend.emails.send(payload)

  if (error) {
    console.error('[email] send failed:', error)
    const err = new Error(error.message || 'Failed to send email')
    err.status = 502
    throw err
  }

  return data
}
