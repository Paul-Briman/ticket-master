// Hardcoded here on purpose — env-var threading through Vite for a
// single visible string isn't worth the complexity, and changing this
// requires a code release anyway. If the support address changes,
// update this string and lib/email.js SUPPORT_EMAIL in lockstep.
const SUPPORT_EMAIL = 'support@ticketsmasterr.com'

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
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-brand hover:text-brand-dark"
          >
            {SUPPORT_EMAIL}
          </a>
        </span>
      </div>
    </footer>
  )
}
