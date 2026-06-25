type ItemStatus = 'pending' | 'cooking' | 'ready' | 'served' | 'cancelled'
type KitchenOrderStatus = 'pending' | 'cooking' | 'ready'

// Derives order status from item statuses (kitchen state machine).
// 'served' is handled separately by serving routes when all items are served.
export function deriveOrderStatus(itemStatuses: ItemStatus[]): KitchenOrderStatus {
  if (itemStatuses.every(s => s === 'ready' || s === 'served')) return 'ready'
  if (itemStatuses.some(s => s === 'cooking')) return 'cooking'
  return 'pending'
}
