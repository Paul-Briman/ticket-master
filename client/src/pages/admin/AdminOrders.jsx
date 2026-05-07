import { useEffect, useState } from 'react'
import Modal from '../../components/Modal.jsx'
import Button from '../../components/Button.jsx'
import TicketEmail from '../../components/TicketEmail.jsx'
import { SkeletonRow } from '../../components/Skeleton.jsx'
import { ORDER_STATUS } from '../../lib/adminStore.jsx'
import { api } from '../../lib/api.js'
import { formatPrice, optionLabel } from '../../lib/price.js'

const STATUS_PILL = {
  [ORDER_STATUS.PAID]: 'bg-green-50 text-green-700 border-green-200',
  [ORDER_STATUS.PENDING]: 'bg-amber-50 text-amber-700 border-amber-200',
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [emailOrder, setEmailOrder] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)
  const [confirmError, setConfirmError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await api.adminOrders()
        if (!cancelled) setOrders(res.orders || [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load orders.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleConfirm(order) {
    setConfirmError('')
    setConfirmingId(order.id)
    try {
      const res = await api.confirmPayment(order.id)
      setOrders((prev) => prev.map((o) => (o.id === order.id ? res.order : o)))
      setEmailOrder(res.order)
    } catch (err) {
      setConfirmError(err.message || 'Could not confirm payment.')
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          Orders
        </h1>
        <p className="text-sm text-gray-500">
          {loading
            ? 'Loading orders...'
            : `${orders.length} order${orders.length === 1 ? '' : 's'} · confirm payments and review the email sent to each customer.`}
        </p>
      </header>

      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} height="h-16" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {confirmError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {confirmError}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => {
                const isPending = o.status === ORDER_STATUS.PENDING
                const isConfirming = confirmingId === o.id
                return (
                  <tr key={o.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">
                          {o.eventTitle}
                        </span>
                        <span className="text-xs text-gray-500">
                          {o.eventDate}
                        </span>
                        <span className="font-mono text-[10px] text-gray-400">
                          {o.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-gray-900">{o.user}</span>
                        <span className="text-xs text-gray-500">
                          {o.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800">
                          {optionLabel(o)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {o.tierLabel} · × {o.quantity}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {formatPrice(o.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                          STATUS_PILL[o.status] || STATUS_PILL[ORDER_STATUS.PENDING]
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {isPending ? (
                          <button
                            type="button"
                            onClick={() => handleConfirm(o)}
                            disabled={isConfirming}
                            className="rounded-md border border-brand bg-brand px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
                          >
                            {isConfirming ? 'Confirming...' : 'Confirm Payment'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEmailOrder(o)}
                            className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-brand hover:text-brand"
                          >
                            View Email
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!loading && orders.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
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

      <Modal
        open={!!emailOrder}
        onClose={() => setEmailOrder(null)}
        title="Customer Email Preview"
        footer={
          <Button
            variant="secondary"
            onClick={() => setEmailOrder(null)}
            type="button"
          >
            Close
          </Button>
        }
      >
        {emailOrder && (
          <div className="space-y-3">
            <div className="rounded-md border border-blue-100 bg-blue-50/40 px-3 py-2 text-xs text-gray-700">
              <span className="font-semibold text-brand">Sent to:</span>{' '}
              {emailOrder.email}
              <span className="mx-2 text-gray-300">·</span>
              <span className="font-semibold text-brand">Subject:</span>{' '}
              Your tickets for {emailOrder.eventTitle} are confirmed
            </div>
            <TicketEmail order={emailOrder} />
          </div>
        )}
      </Modal>
    </div>
  )
}
