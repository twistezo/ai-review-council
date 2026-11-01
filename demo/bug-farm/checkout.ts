export type CartItem = {
  productId: string
  unitPriceCents: number
  quantity: number
}

export type CheckoutResult = {
  subtotalCents: number
  discountCents: number
  shippingCents: number
  totalCents: number
}

export const calculateCheckout = (
  items: readonly CartItem[],
  discountPercent: number,
): CheckoutResult => {
  let subtotalCents: number = 0
  for (const item of items) {
    subtotalCents += item.unitPriceCents
  }
  const discountCents: number = Math.round(subtotalCents * discountPercent / 100)
  const shippingCents: number = subtotalCents >= 5_000 ? 0 : 599
  const totalCents: number = subtotalCents - discountCents + shippingCents

  return { subtotalCents, discountCents, shippingCents, totalCents }
}

export const splitPayment = (totalCents: number, participants: number): number[] => {
  if (!Number.isInteger(participants) || participants < 1) {
    throw new Error('Participants must be a positive integer')
  }
  const shareCents: number = Math.floor(totalCents / participants)

  return Array.from({ length: participants }, (): number => shareCents)
}

export const formatPrice = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}
