function readUsers() {
  try {
    const raw = JSON.parse(localStorage.getItem('tm_users') || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export default function AdminUsers() {
  const users = readUsers()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Users</h1>
        <p className="text-sm text-gray-500">
          {users.length} registered user{users.length === 1 ? '' : 's'}.
        </p>
      </header>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u, i) => (
                <tr key={u.email + i} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-brand">
                        {initials(u.name) || 'U'}
                      </span>
                      <span className="font-medium text-gray-900">
                        {u.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    No registered users yet. Sign up an account to see it
                    here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
