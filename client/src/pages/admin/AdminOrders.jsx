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
  [ORDER_STATUS.REJECTED]: 'bg-red-50 text-red-700 border-red-200',
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [emailOrder, setEmailOrder] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)
  const [confirmError, setConfirmError] = useState('')
  const [rejecting, setRejecting] = useState(null) // order being rejected
  const [rejectReason, setRejectReason] = useState('')
  const [rejectSubmitting, setRejectSubmitting] = useState(false)
  const [rejectError, setRejectError] = useState('')

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

  function openReject(order) {
    setRejecting(order)
    setRejectReason('')
    setRejectError('')
  }

  function closeReject() {
    setRejecting(null)
    setRejectReason('')
    setRejectError('')
  }

  async function handleReject() {
    if (!rejecting) return
    setRejectError('')
    setRejectSubmitting(true)
    try {
      const res = await api.rejectPayment(rejecting.id, rejectReason)
      setOrders((prev) =>
        prev.map((o) => (o.id === rejecting.id ? res.order : o)),
      )
      closeReject()
    } catch (err) {
      setRejectError(err.message || 'Could not reject payment.')
    } finally {
      setRejectSubmitting(false)
    }
  }

  const counts = {
    pending: orders.filter((o) => o.status === ORDER_STATUS.PENDING).length,
    paid: orders.filter((o) => o.status === ORDER_STATUS.PAID).length,
    rejected: orders.filter((o) => o.status === ORDER_STATUS.REJECTED).length,
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
            : `${orders.length} order${orders.length === 1 ? '' : 's'} · ${
                counts.pending
              } pending · ${counts.paid} confirmed${
                counts.rejected ? ` · ${counts.rejected} rejected` : ''
              }`}
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
                const isPaid = o.status === ORDER_STATUS.PAID
                const isRejected = o.status === ORDER_STATUS.REJECTED
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
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                            STATUS_PILL[o.status] || STATUS_PILL[ORDER_STATUS.PENDING]
                          }`}
                        >
                          {o.status}
                        </span>
                        {isRejected && o.rejectionReason && (
                          <span
                            className="max-w-[200px] truncate text-[10px] text-red-700"
                            title={o.rejectionReason}
                          >
                            {o.rejectionReason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleConfirm(o)}
                              disabled={isConfirming}
                              className="rounded-md border border-brand bg-brand px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
                            >
                              {isConfirming ? 'Confirming...' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openReject(o)}
                              disabled={isConfirming}
                              className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {isPaid && (
                          <button
                            type="button"
                            onClick={() => setEmailOrder(o)}
                            className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-brand hover:text-brand"
                          >
                            View Email
                          </button>
                        )}
                        {isRejected && (
                          <span className="text-xs text-gray-400">
                            No actions available
                          </span>
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

      {/* Reject reason modal — shown only when admin clicks Reject. */}
      <Modal
        open={!!rejecting}
        onClose={closeReject}
        title={rejecting ? `Reject order ${rejecting.id}` : 'Reject order'}
        footer={
          <>
            <Button
              variant="secondary"
              type="button"
              onClick={closeReject}
              disabled={rejectSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReject}
              disabled={rejectSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {rejectSubmitting ? 'Rejecting...' : 'Reject payment'}
            </Button>
          </>
        }
      >
        {rejecting && (
          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-red-100 bg-red-50/50 px-3 py-2 text-xs text-red-800">
              The customer's order will be moved to the "Rejected" section in
              their My Tickets page. The reason below (optional) is shown to
              them. This action is final — confirm or reject deliberately.
            </div>

            <div className="text-sm text-gray-700">
              <p>
                <span className="font-semibold">{rejecting.eventTitle}</span>{' '}
                — {rejecting.tierLabel}, × {rejecting.quantity},{' '}
                {formatPrice(rejecting.total)}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {rejecting.user} · {rejecting.email}
              </p>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Reason for the customer (optional)
              </span>
              <textarea
                rows={3}
                placeholder="e.g. We couldn't verify the transaction hash. Please re-submit with a clearer screenshot."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                maxLength={500}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-300/50"
              />
              <span className="text-[11px] text-gray-400">
                {rejectReason.length} / 500
              </span>
            </label>

            {rejectError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {rejectError}
              </div>
            )}
          </div>
        )}
      </Modal>

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
