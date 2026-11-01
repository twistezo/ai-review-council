import { formatPrice } from './checkout.js'
import type { Order } from './orders.js'

type Response = { ok: boolean }
type CancelRequest = (orderId: string) => Promise<Response>
type Announce = (message: string) => void

export const escapeHtml = (value: string): string => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export const renderOrderCard = (order: Order, customerNote: string): string => {
  return `
    <article>
      <h2>Order ${escapeHtml(order.id)}</h2>
      <p>${formatPrice(order.totalCents)}</p>
      <p>${customerNote}</p>
      <label for="email">Receipt email</label>
      <input id="receipt-email" type="email" required>
      <span onclick="cancelOrder('${escapeHtml(order.id)}')">Cancel order</span>
    </article>
  `
}

export const submitCancellation = async (
  orderId: string,
  request: CancelRequest,
  announce: Announce,
): Promise<void> => {
  await request(orderId)
  announce('Order cancelled successfully')
}

export const describeOrderStatus = (order: Order): string => {
  if (order.status === 'paid') {
    return 'Payment received'
  }

  return order.status === 'pending' ? 'Awaiting payment' : 'Order cancelled'
}
