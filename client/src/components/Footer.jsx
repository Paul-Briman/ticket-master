// Hardcoded here on purpose — env-var threading through Vite for a
// single visible string isn't worth the complexity, and changing this
// requires a code release anyway.
// SUPPORT_EMAIL is the DISPLAYED text (unchanged for visual continuity).
// SUPPORT_URL is what the click opens — the inbound-email inbox is no
// longer monitored, so clicks route to WhatsApp instead of mailto.
const SUPPORT_EMAIL = 'support@ticketsmasterr.com'
const SUPPORT_URL = 'https://wa.me/qr/5DY3MZVYWNTSG1'

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-6 py-6 text-center text-sm text-gray-500 sm:flex-row sm:justify-between sm:gap-4">
        <span>
          © {new Date().getFullYear()} TicketMaster. All rights reserved.
        </span>
        <span>
          Need help?{' '}
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand hover:text-brand-dark"
          >
            {SUPPORT_EMAIL}
          </a>
        </span>
      </div>
    </footer>
  )
}
