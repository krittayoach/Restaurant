'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Plus, Minus, ShoppingCart, MessageSquare, UtensilsCrossed, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useI18n, LangToggle } from '@/lib/i18n'
import Link from 'next/link'
import { Star } from 'lucide-react'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

interface MenuItem { id: string; name: string; price: number; category_id?: string; description?: string; image?: string }
interface CartItem extends MenuItem { quantity: number }

export default function OrderPage() {
  const params = useParams() as { slug: string; qrToken: string }
  const router = useRouter()
  const { t, lang, setLang } = useI18n()
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [tableInfo, setTableInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null)
  const [customerPoints, setCustomerPoints] = useState(0)
  const [usePoints, setUsePoints] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const MIN_REDEEM = 100

  const debouncedPhone = useDebounce(phone, 500)

  useEffect(() => {
    setExistingOrderId(sessionStorage.getItem('currentOrderId'))
    async function load() {
      const table = await api.get(`/tables/resolve/${params.qrToken}?slug=${params.slug}`)
      setTableInfo(table)
      const [items, cats] = await Promise.all([
        api.get(`/menus?restaurantId=${table.restaurant_id}`),
        api.get(`/categories?restaurantId=${table.restaurant_id}`),
      ])
      setMenus(items); setCategories(cats); setPageLoading(false)
    }
    load()
  }, [])

  // Debounced points lookup — fires only after user stops typing
  useEffect(() => {
    const normalized = debouncedPhone.replace(/\D/g, '')
    if (normalized.length >= 9 && tableInfo?.restaurant_id) {
      const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010'
      fetch(`${API}/customers/points?restaurantId=${tableInfo.restaurant_id}&phone=${normalized}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setCustomerPoints(d.total_points ?? 0) })
        .catch(() => null)
    } else {
      setCustomerPoints(0)
      setUsePoints(false)
    }
  }, [debouncedPhone, tableInfo])

  const add    = (item: MenuItem) => setCart(c => c.find(i => i.id === item.id) ? c.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i) : [...c, { ...item, quantity: 1 }])
  const remove = (id: string)     => setCart(c => c.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0))
  const qty    = (id: string)     => cart.find(c => c.id === id)?.quantity ?? 0
  const totalQty  = cart.reduce((s, i) => s + i.quantity, 0)
  const subtotal  = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const pointsDiscount = usePoints ? customerPoints : 0
  const total  = Math.max(0, subtotal - pointsDiscount)

  const cartItems = cart.map(i => ({
    menu_id: i.id, menu_name: i.name, quantity: i.quantity, unit_price: i.price,
    ...(notes[i.id] ? { note: notes[i.id] } : {}),
  }))

  async function submitOrder() {
    if (cart.length === 0) { setError(t.errorSelectItems); return }
    setLoading(true); setError('')
    try {
      if (existingOrderId) {
        await api.post(`/orders/${existingOrderId}/add-items`, { items: cartItems })
      } else {
        if (!name || !phone) { setError(t.errorNamePhone); setLoading(false); return }
        const { token } = await api.post('/auth/customer', { name, phone })
        const { orderId } = await api.post('/orders', {
          restaurantId:  tableInfo.restaurant_id,
          tableId:       tableInfo.id,
          items:         cartItems,
          ...(usePoints && customerPoints >= MIN_REDEEM ? { redeemPoints: customerPoints } : {}),
        }, token)
        sessionStorage.setItem('currentOrderId', orderId)
      }
      router.push(`/r/${params.slug}/table/${params.qrToken}/payment`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const grouped = categories
    .map((cat: any) => ({ ...cat, items: menus.filter(m => m.category_id === cat.id) }))
    .filter(cat => cat.items.length > 0)
  const uncategorized = menus.filter(m => !m.category_id)

  if (pageLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-center">
        <div className="size-10 rounded-full border-[3px] border-accent border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-accent text-sm font-medium">{t.loadingMenu}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg2/90 backdrop-blur border-b border-border px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="font-bold text-sm text-text">
              {existingOrderId ? t.addMoreTitle : t.orderTitle}
            </p>
            <p className="text-xs text-accent font-medium">{t.table} {tableInfo?.label}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/r/${params.slug}/me`} className="flex items-center gap-1 text-xs text-accent font-semibold hover:text-accent2">
              <Star size={13} aria-hidden="true" />{lang === 'th' ? 'แต้ม' : 'Points'}
            </Link>
            <LangToggle lang={lang} setLang={setLang} />
          </div>
        </div>
      </div>

      {/* Add-mode banner */}
      {existingOrderId && (
        <div className="max-w-lg mx-auto px-4 pt-3">
          <div className="bg-teal/10 border border-teal/30 text-teal rounded-2xl px-4 py-2.5 text-xs font-semibold">
            {t.addMoreBanner}
          </div>
        </div>
      )}

      {/* Category jump bar */}
      {grouped.length > 1 && (
        <div className="sticky top-[61px] z-10 bg-bg2/95 backdrop-blur border-b border-border px-4 py-2">
          <div className="max-w-lg mx-auto flex gap-2 overflow-x-auto scrollbar-hide">
            {grouped.map((cat: any) => (
              <button key={cat.id}
                onClick={() => document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-bg3 text-accent hover:bg-border transition-colors whitespace-nowrap">
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pt-3 pb-32">
        {grouped.map((cat: any) => (
          <div key={cat.id} id={`cat-${cat.id}`} className="mb-6 scroll-mt-24">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-border" />
              <p className="text-xs font-bold text-accent uppercase tracking-widest px-2">{cat.name}</p>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {cat.items.map((item: MenuItem) => (
                <MenuItemCard key={item.id} item={item} qty={qty(item.id)} onAdd={() => add(item)} onRemove={() => remove(item.id)} addLabel={t.addItem} />
              ))}
            </div>
          </div>
        ))}
        {uncategorized.length > 0 && (
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-3">
              {uncategorized.map((item: MenuItem) => (
                <MenuItemCard key={item.id} item={item} qty={qty(item.id)} onAdd={() => add(item)} onRemove={() => remove(item.id)} addLabel={t.addItem} />
              ))}
            </div>
          </div>
        )}
        {menus.length === 0 && (
          <div className="text-center py-16">
            <UtensilsCrossed size={32} className="text-border2 mx-auto mb-3" />
            <p className="text-muted text-sm">{t.noMenu}</p>
          </div>
        )}
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 inset-x-0 p-4 pb-safe bg-bg2/95 backdrop-blur border-t border-border">
        <div className="max-w-lg mx-auto">
          {cart.length > 0 ? (
            <button onClick={() => setCartOpen(true)}
              className="btn-primary w-full py-4 text-base flex items-center justify-between px-5 shadow-lg hover:shadow-xl active:scale-[.98]">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} aria-hidden="true" />
                <span className="size-5 rounded-full bg-white/20 text-xs font-bold flex items-center justify-center">{totalQty}</span>
              </div>
              <span>{existingOrderId ? t.addOrderBtn(total.toFixed(0)) : t.orderBtn(total.toFixed(0))}</span>
              <span className="size-[18px] opacity-0" aria-hidden="true" />
            </button>
          ) : (
            <button disabled
              className="w-full py-4 rounded-2xl bg-bg3 text-muted font-bold text-base cursor-not-allowed">
              {t.selectItems}
            </button>
          )}
        </div>
      </div>

      {/* Cart bottom sheet */}
      {cartOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-modal" onClick={() => setCartOpen(false)} />
          <div className="fixed bottom-0 inset-x-0 z-modal bg-bg2 rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto pb-safe">
            <div className="max-w-lg mx-auto p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold text-text text-base">{t.selectedItems}</p>
                <button onClick={() => setCartOpen(false)}
                  aria-label={lang === 'th' ? 'ปิด' : 'Close'}
                  className="size-8 rounded-xl bg-bg3 border border-border flex items-center justify-center hover:bg-border transition-colors">
                  <X size={15} className="text-muted" />
                </button>
              </div>

              {/* Cart items */}
              <div className="space-y-3 mb-4">
                {cart.map(i => (
                  <div key={i.id}>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => remove(i.id)}
                          aria-label={`${lang === 'th' ? 'ลด' : 'Remove'} ${i.name}`}
                          className="size-8 rounded-lg bg-bg3 border border-border flex items-center justify-center hover:bg-border transition-colors">
                          <Minus size={12} className="text-accent" />
                        </button>
                        <span className="w-5 text-center text-sm font-bold text-text">{i.quantity}</span>
                        <button onClick={() => add(i)}
                          aria-label={`${lang === 'th' ? 'เพิ่ม' : 'Add'} ${i.name}`}
                          className="size-8 rounded-lg bg-bg3 border border-border flex items-center justify-center hover:bg-border transition-colors">
                          <Plus size={12} className="text-accent" />
                        </button>
                      </div>
                      <span className="flex-1 text-sm font-medium text-text">{i.name}</span>
                      <span className="text-sm font-bold text-accent shrink-0">฿{(i.price * i.quantity).toFixed(0)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 ml-1">
                      <MessageSquare size={12} className="text-border2 shrink-0" aria-hidden="true" />
                      <input
                        value={notes[i.id] ?? ''}
                        onChange={e => setNotes(n => ({ ...n, [i.id]: e.target.value }))}
                        placeholder={t.notePlaceholder}
                        className="flex-1 text-xs border border-border rounded-lg px-3 py-1.5 bg-bg3 placeholder-muted/60 focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {pointsDiscount > 0 && (
                <div className="flex justify-between text-sm text-accent font-medium mb-1">
                  <span>{lang === 'th' ? 'ส่วนลดแต้ม' : 'Points Discount'}</span>
                  <span>-฿{pointsDiscount}</span>
                </div>
              )}
              <div className="border-t border-border pt-3 flex justify-between font-bold mb-4">
                <span className="text-text">{t.total}</span>
                <span className="text-accent text-lg">฿{total.toFixed(0)}</span>
              </div>

              {/* Customer info — only for new order */}
              {!existingOrderId && (
                <div className="bg-bg3 rounded-2xl border border-border p-4 space-y-3 mb-4">
                  <p className="text-xs font-bold text-accent uppercase tracking-wider">{t.yourInfo}</p>
                  <div>
                    <label className="block text-xs text-muted mb-1.5 font-medium">
                      {t.name} <span className="text-rose">*</span>
                    </label>
                    <input value={name} onChange={e => setName(e.target.value)}
                      placeholder={t.namePlaceholder} className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1.5 font-medium">
                      {t.phone} <span className="text-rose">*</span>
                    </label>
                    <input value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder={t.phonePlaceholder} type="tel" className="input w-full" />
                  </div>
                  {customerPoints >= MIN_REDEEM && (
                    <div className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 border transition-all ${usePoints ? 'bg-accent/5 border-accent/40' : 'bg-bg2 border-border'}`}>
                      <div>
                        <p className="text-xs font-semibold text-text">
                          {lang === 'th' ? `ใช้ ${customerPoints} แต้ม` : `Use ${customerPoints} pts`}
                          <span className="text-accent ml-1">(-฿{customerPoints})</span>
                        </p>
                        <p className="text-xs text-muted">
                          {lang === 'th' ? `ลดราคาได้ ฿${customerPoints}` : `฿${customerPoints} discount`}
                        </p>
                      </div>
                      <button type="button" onClick={() => setUsePoints(u => !u)}
                        aria-label={lang === 'th' ? 'ใช้แต้มสะสม' : 'Use reward points'}
                        className={`w-11 h-6 rounded-full transition-all duration-200 ${usePoints ? 'bg-accent' : 'bg-border2'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mx-0.5 ${usePoints ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-rose/10 border border-rose/30 text-rose rounded-xl px-4 py-2.5 text-sm font-medium mb-4">
                  {error}
                </div>
              )}

              <button onClick={submitOrder} disabled={loading}
                className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2">
                <ShoppingCart size={18} aria-hidden="true" />
                {loading ? t.sending
                  : existingOrderId ? t.addOrderBtn(total.toFixed(0)) : t.orderBtn(total.toFixed(0))}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MenuItemCard({ item, qty, onAdd, onRemove, addLabel }: {
  item: MenuItem; qty: number; onAdd: () => void; onRemove: () => void; addLabel: string
}) {
  return (
    <div className={cn(
      'bg-bg2 rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-all',
      qty > 0 ? 'border-accent/40 shadow-accent/10' : 'border-border',
    )}>
      <div className="aspect-[4/3] w-full bg-bg3 overflow-hidden relative">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🍽️</div>
        )}
        {qty > 0 && (
          <div className="absolute top-2 left-2 min-w-[22px] h-[22px] px-1 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shadow">
            {qty}
          </div>
        )}
      </div>

      <div className="px-3 pt-2.5 pb-1.5 flex-1">
        <p className="font-semibold text-sm text-text line-clamp-2 leading-snug">{item.name}</p>
        {item.description && (
          <p className="text-xs text-muted mt-0.5 line-clamp-2 leading-snug">{item.description}</p>
        )}
        <p className="font-bold text-accent text-sm mt-1">฿{item.price}</p>
      </div>

      <div className="px-2.5 pb-2.5">
        {qty === 0 ? (
          <button onClick={onAdd} aria-label={`${addLabel} ${item.name}`}
            className="w-full py-2 rounded-xl bg-accent hover:bg-accent2 active:scale-95 text-white flex items-center justify-center gap-1 text-sm font-bold transition-all shadow-sm">
            <Plus size={14} strokeWidth={3} aria-hidden="true" /> {addLabel}
          </button>
        ) : (
          <div className="flex items-center justify-between bg-bg3 rounded-xl border border-border p-1 gap-1">
            <button onClick={onRemove} aria-label={`ลด ${item.name}`}
              className="size-8 rounded-lg bg-bg2 border border-border flex items-center justify-center shadow-sm active:scale-90 transition-transform">
              <Minus size={13} className="text-accent" strokeWidth={2.5} />
            </button>
            <span className="font-bold text-sm text-accent flex-1 text-center">{qty}</span>
            <button onClick={onAdd} aria-label={`เพิ่ม ${item.name}`}
              className="size-8 rounded-lg bg-accent flex items-center justify-center shadow-sm active:scale-90 transition-transform">
              <Plus size={13} className="text-white" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
