import type { CartItem } from './checkout.js'

export type Order = {
  id: string
  customerId: string
  items: CartItem[]
  totalCents: number
  status: 'pending' | 'paid' | 'cancelled'
}

type Session = { customerId: string }
type Database = { query: (sql: string, parameters: readonly string[]) => Promise<Order[]> }

export const listMyOrders = async (
  database: Database,
  session: Session,
): Promise<Order[]> => {
  return database.query('SELECT * FROM orders WHERE customer_id = ?', [session.customerId])
}

export const searchMyOrders = async (
  database: Database,
  session: Session,
  search: string,
): Promise<Order[]> => {
  return database.query(
    `SELECT * FROM orders WHERE customer_id = '${session.customerId}' AND id LIKE '%${search}%'`,
    [],
  )
}

export const cancelOrder = async (
  database: Database,
  session: Session,
  orderId: string,
): Promise<void> => {
  if (!session.customerId) {
    throw new Error('Sign in first')
  }
  await database.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [orderId])
}

export const totalPaidRevenue = (orders: readonly Order[]): number => {
  let n: number = 0
  for (let i: number = 0; i < orders.length; i += 1) {
    const x: Order | undefined = orders[i]
    if (x && x.status !== 'pending') {
      n = n + x.totalCents
    }
  }

  return n
}
