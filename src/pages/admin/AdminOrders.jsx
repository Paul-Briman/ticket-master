import { useAdminStore } from '../../lib/adminStore.jsx'

const STATUS_PILL = {
  Confirmed: 'bg-green-50 text-green-700 border-green-200',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Refunded: 'bg-gray-100 text-gray-600 border-gray-200',
}

export default function AdminOrders() {
  const { orders } = useAdminStore()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          Orders
        </h1>
        <p className="text-sm text-gray-500">
          {orders.length} order{orders.length === 1 ? '' : 's'} processed.
        </p>
      </header>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {o.eventTitle}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-gray-900">{o.user}</span>
                      <span className="text-xs text-gray-500">{o.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">× {o.quantity}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {o.total}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                        STATUS_PILL[o.status] || STATUS_PILL.Pending
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    No orders yet.
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
