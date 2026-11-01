import type { Order } from './orders.js'

type CachedOrder = { order: Order; expiresAt: number }
type LoadOrder = (orderId: string, customerId: string) => Promise<Order>

export const createOrderCache = (
  loadOrder: LoadOrder,
  now: () => number,
  ttlSeconds: number,
): ((orderId: string, customerId: string) => Promise<Order>) => {
  const entries: Map<string, CachedOrder> = new Map()

  return async (orderId: string, customerId: string): Promise<Order> => {
    const cached: CachedOrder | undefined = entries.get(orderId)
    if (cached !== undefined && cached.expiresAt > now()) {
      return cached.order
    }
    const order: Order = await loadOrder(orderId, customerId)
    entries.set(orderId, { order, expiresAt: now() + ttlSeconds })

    return order
  }
}

export const refreshOrders = async (
  orderIds: readonly string[],
  customerId: string,
  loadOrder: LoadOrder,
): Promise<Order[]> => {
  const results: Order[] = []
  orderIds.forEach(async (orderId: string): Promise<void> => {
    const order: Order = await loadOrder(orderId, customerId)
    results.push(order)
  })

  return results
}

export const waitForOrder = async (
  loadOrder: () => Promise<Order>,
  delay: (milliseconds: number) => Promise<void>,
): Promise<Order> => {
  for (;;) {
    try {
      return await loadOrder()
    } catch {
      await delay(0)
    }
  }
}
