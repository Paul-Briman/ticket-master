// One-off bootstrap script: creates an admin user record in
// production KV with a password you supply interactively.
//
// SAFETY CONTRACT — this script only ever performs these 2 KV writes:
//   1. SET  tm:user:<email>      { role: 'admin', isVerified: true, ... }
//   2. SET  tm:user-emails       (existing array + the new email)
//
// It does NOT touch tm:orders, tm:event-overrides, tm:event-snapshots,
// tm:admin-events, or any other user's tm:user:<email> record.
//
// If a user with this email already exists in KV, the script ABORTS
// rather than overwriting. To replace an existing record, delete it
// first via the admin UI (/admin/users) and re-run.
//
// USAGE:
//   1. vercel env pull .env.production.local --environment=production
//   2. node scripts/create-admin.mjs admin@ticketsmasterr.com
//   3. Enter password when prompted (twice — second is a re-type)
//   4. Delete .env.production.local when done

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'
import bcrypt from 'bcryptjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// === 1. Load env from .env.production.local ===
const envPath = resolve(__dirname, '..', '.env.production.local')
if (!existsSync(envPath)) {
  console.error('ERROR: .env.production.local not found at', envPath)
  console.error('Run first: vercel env pull .env.production.local --environment=production')
  process.exit(1)
}

const envText = readFileSync(envPath, 'utf8')
for (const raw of envText.split(/\r?\n/)) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue
  const eq = line.indexOf('=')
  if (eq < 0) continue
  const key = line.slice(0, eq).trim()
  let val = line.slice(eq + 1).trim()
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1)
  }
  if (!(key in process.env)) process.env[key] = val
}

if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  console.error('ERROR: KV_REST_API_URL and/or KV_REST_API_TOKEN not in .env.production.local')
  console.error('Re-run: vercel env pull .env.production.local --environment=production')
  process.exit(1)
}

// === 2. Parse CLI arg ===
const rawEmail = process.argv[2]
if (!rawEmail) {
  console.error('Usage: node scripts/create-admin.mjs <email>')
  console.error('Example: node scripts/create-admin.mjs admin@ticketsmasterr.com')
  process.exit(1)
}
const normalizedEmail = rawEmail.trim().toLowerCase()
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
  console.error('ERROR: not a valid email:', normalizedEmail)
  process.exit(1)
}

const userKey = `tm:user:${normalizedEmail}`
const userIndexKey = 'tm:user-emails'

console.log()
console.log('Target KV:', process.env.KV_REST_API_URL.replace(/^https?:\/\//, ''))
console.log('Target user key:', userKey)
console.log()

// === 3. Connect to KV and bail if user already exists ===
const { kv } = await import('@vercel/kv')

const existing = await kv.get(userKey)
if (existing) {
  console.error('ERROR: a user already exists at this key:')
  console.error('   email:    ', existing.email)
  console.error('   role:     ', existing.role)
  console.error('   verified: ', existing.isVerified ?? existing.verified)
  console.error('   created:  ', existing.createdAt)
  console.error()
  console.error('Refusing to overwrite. If you really want to replace this record:')
  console.error('  1. Log in as the existing admin (admin@ticket.com)')
  console.error('  2. Delete this user from /admin/users')
  console.error('  3. Re-run this script')
  process.exit(1)
}

// === 4. Prompt for password (hidden input, with re-type confirmation) ===
console.log('No existing user — safe to create a new admin record.')
console.log()
console.log('Setting password for', normalizedEmail)
console.log('(Typing will be hidden — asterisks shown for feedback.)')
console.log()

const password = await askHidden('Password (min 6 chars): ')
if (!password || password.length < 6) {
  console.error('ERROR: password must be at least 6 characters.')
  process.exit(1)
}
const confirm = await askHidden('Re-enter password:        ')
if (password !== confirm) {
  console.error('ERROR: passwords do not match. Nothing written.')
  process.exit(1)
}

// === 5. Hash + write ===
console.log()
console.log('Hashing password (bcrypt, 10 rounds — same as the rest of the app)...')
const passwordHash = await bcrypt.hash(password, 10)
const now = new Date().toISOString()

const userRecord = {
  name: 'Admin',
  email: normalizedEmail,
  passwordHash,
  role: 'admin',
  isVerified: true,
  createdAt: now,
  verifiedAt: now,
}

console.log('Writing user record to', userKey, '...')
await kv.set(userKey, userRecord)

console.log('Updating email index...')
const emails = (await kv.get(userIndexKey)) || []
if (Array.isArray(emails) && !emails.includes(normalizedEmail)) {
  emails.push(normalizedEmail)
  await kv.set(userIndexKey, emails)
  console.log('  appended — index now contains', emails.length, 'emails')
} else if (Array.isArray(emails)) {
  console.log('  email already in index — no change')
} else {
  await kv.set(userIndexKey, [normalizedEmail])
  console.log('  index was missing, created fresh with 1 email')
}

// === 6. Verify by reading back ===
console.log()
console.log('Verifying write by reading back...')
const verify = await kv.get(userKey)
if (!verify) {
  console.error('ERROR: read-back returned nothing. KV may have rejected the write.')
  process.exit(1)
}
if (verify.role !== 'admin') {
  console.error(`ERROR: read-back role="${verify.role}" (expected "admin")`)
  process.exit(1)
}
if (!verify.isVerified) {
  console.error('ERROR: read-back isVerified is false')
  process.exit(1)
}
const passOk = await bcrypt.compare(password, verify.passwordHash)
if (!passOk) {
  console.error('ERROR: read-back password hash does not validate against input')
  process.exit(1)
}

console.log()
console.log('===================================================')
console.log('  SUCCESS')
console.log('===================================================')
console.log('  email:        ', verify.email)
console.log('  role:         ', verify.role)
console.log('  verified:     ', verify.isVerified)
console.log('  password hash:', 'valid (round-trip confirmed)')
console.log('===================================================')
console.log()
console.log('Next steps:')
console.log('  1. Log in at https://ticketsmasterr.com/login with')
console.log('     ', normalizedEmail, 'and the password you just set.')
console.log('  2. Verify you can reach /admin and all admin tabs.')
console.log('  3. Delete .env.production.local from this folder when done.')
console.log()

process.exit(0)

// =========================================================
// Helpers
// =========================================================

function askHidden(prompt) {
  return new Promise((resolveAnswer) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    process.stdout.write(prompt)
    const stdin = process.stdin
    const wasRaw = stdin.isRaw
    if (typeof stdin.setRawMode === 'function') stdin.setRawMode(true)
    let value = ''
    const onData = (key) => {
      const ch = key.toString('utf8')
      if (ch === '\r' || ch === '\n') {
        if (typeof stdin.setRawMode === 'function') stdin.setRawMode(wasRaw)
        stdin.off('data', onData)
        rl.close()
        process.stdout.write('\n')
        resolveAnswer(value)
      } else if (ch === '') {
        // Ctrl+C
        if (typeof stdin.setRawMode === 'function') stdin.setRawMode(wasRaw)
        stdin.off('data', onData)
        rl.close()
        process.stdout.write('\n')
        process.exit(130)
      } else if (ch === '' || ch === '\b') {
        // backspace
        if (value.length > 0) {
          value = value.slice(0, -1)
          process.stdout.write('\b \b')
        }
      } else {
        value += ch
        process.stdout.write('*')
      }
    }
    stdin.on('data', onData)
  })
}
