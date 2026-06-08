'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Plus, Minus, ShoppingCart, MessageSquare, UtensilsCrossed } from 'lucide-react'
import { useI18n, LangToggle } from '@/lib/i18n'
import Link from 'next/link'
import { Star } from 'lucide-react'

interface MenuItem { id: string; name: string; price: number; category_id?: string; description?: string }
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
  const MIN_REDEEM = 100

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

  const add    = (item: MenuItem) => setCart(c => c.find(i => i.id === item.id) ? c.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i) : [...c, { ...item, quantity: 1 }])
  const remove = (id: string)     => setCart(c => c.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0))
  const qty    = (id: string)     => cart.find(c => c.id === id)?.quantity ?? 0
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #fff8f0 0%, #fff3e6 100%)' }}>
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-[3px] border-orange-400 border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-orange-400 text-sm font-medium">{t.loadingMenu}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #fff8f0 0%, #fff3e6 100%)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-orange-100 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="font-bold text-sm text-gray-800">
              {existingOrderId ? t.addMoreTitle : t.orderTitle}
            </p>
            <p className="text-xs text-orange-400 font-medium">{t.table} {tableInfo?.label}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/r/${params.slug}/me`} className="flex items-center gap-1 text-xs text-orange-400 font-semibold hover:text-orange-500">
              <Star size={13} />{lang === 'th' ? 'แต้ม' : 'Points'}
            </Link>
            <LangToggle lang={lang} setLang={setLang} />
            <button onClick={() => document.getElementById('cart-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="relative w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center hover:bg-orange-100 transition-colors">
              <ShoppingCart size={18} className="text-orange-400" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-orange-400 text-white text-xs font-bold flex items-center justify-center shadow">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Add-mode banner */}
      {existingOrderId && (
        <div className="max-w-lg mx-auto px-4 pt-3">
          <div className="bg-teal-50 border border-teal-200 text-teal-700 rounded-2xl px-4 py-2.5 text-xs font-semibold">
            {t.addMoreBanner}
          </div>
        </div>
      )}

      {/* Category jump bar */}
      {grouped.length > 1 && (
        <div className="sticky top-[61px] z-10 bg-white/95 backdrop-blur border-b border-orange-100 px-4 py-2">
          <div className="max-w-lg mx-auto flex gap-2 overflow-x-auto scrollbar-hide">
            {grouped.map((cat: any) => (
              <button key={cat.id}
                onClick={() => document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-orange-50 text-orange-400 hover:bg-orange-100 transition-colors whitespace-nowrap">
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pt-3 pb-32">
        {/* Menu */}
        {grouped.map((cat: any) => (
          <div key={cat.id} id={`cat-${cat.id}`} className="mb-6 scroll-mt-24">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-orange-100" />
              <p className="text-xs font-bold text-orange-400 uppercase tracking-widest px-2">{cat.name}</p>
              <div className="h-px flex-1 bg-orange-100" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {cat.items.map((item: MenuItem) => (
                <MenuItemCard key={item.id} item={item} qty={qty(item.id)} onAdd={() => add(item)} onRemove={() => remove(item.id)} />
              ))}
            </div>
          </div>
        ))}
        {uncategorized.length > 0 && (
          <div className="mb-6">
            <div className="grid grid-cols-4 gap-2">
              {uncategorized.map((item: MenuItem) => (
                <MenuItemCard key={item.id} item={item} qty={qty(item.id)} onAdd={() => add(item)} onRemove={() => remove(item.id)} />
              ))}
            </div>
          </div>
        )}
        {menus.length === 0 && (
          <div className="text-center py-16">
            <UtensilsCrossed size={32} className="text-orange-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{t.noMenu}</p>
          </div>
        )}

        {/* Cart summary */}
        {cart.length > 0 && (
          <div id="cart-section" className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4 mt-4">
            <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-3">{t.selectedItems}</p>
            <div className="space-y-3 mb-4">
              {cart.map(i => (
                <div key={i.id}>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => remove(i.id)}
                        className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center hover:bg-orange-100 transition-colors">
                        <Minus size={12} className="text-orange-400" />
                      </button>
                      <span className="w-5 text-center text-sm font-bold text-gray-700">{i.quantity}</span>
                      <button onClick={() => add(i)}
                        className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center hover:bg-orange-100 transition-colors">
                        <Plus size={12} className="text-orange-400" />
                      </button>
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-700">{i.name}</span>
                    <span className="text-sm font-bold text-orange-500 shrink-0">฿{(i.price * i.quantity).toFixed(0)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 ml-1">
                    <MessageSquare size={12} className="text-gray-300 shrink-0" />
                    <input
                      value={notes[i.id] ?? ''}
                      onChange={e => setNotes(n => ({ ...n, [i.id]: e.target.value }))}
                      placeholder={t.notePlaceholder}
                      className="flex-1 text-xs border border-orange-100 rounded-lg px-3 py-1.5 bg-orange-50 placeholder-gray-300 focus:outline-none focus:border-orange-300 transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>
            {pointsDiscount > 0 && (
              <div className="flex justify-between text-sm text-orange-400 font-medium">
                <span>{lang === 'th' ? 'ส่วนลดแต้ม' : 'Points Discount'}</span>
                <span>-฿{pointsDiscount}</span>
              </div>
            )}
            <div className="border-t border-orange-100 pt-3 flex justify-between font-bold">
              <span className="text-gray-600">{t.total}</span>
              <span className="text-orange-500 text-lg">฿{total.toFixed(0)}</span>
            </div>
          </div>
        )}

        {/* Customer info — only for new order */}
        {!existingOrderId && cart.length > 0 && (
          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4 space-y-3 mt-4">
            <p className="text-xs font-bold text-orange-400 uppercase tracking-wider">{t.yourInfo}</p>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">{t.name} <span className="text-rose-400">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={t.namePlaceholder}
                className="w-full border border-orange-100 rounded-xl px-3.5 py-2.5 text-sm bg-orange-50/50 placeholder-gray-300 focus:outline-none focus:border-orange-300 transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">{t.phone} <span className="text-rose-400">*</span></label>
              <input value={phone}
                onChange={async e => {
                  setPhone(e.target.value)
                  const normalized = e.target.value.replace(/\D/g, '')
                  if (normalized.length >= 9 && tableInfo?.restaurant_id) {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/customers/points?restaurantId=${tableInfo.restaurant_id}&phone=${normalized}`).catch(() => null)
                    if (res?.ok) { const d = await res.json(); setCustomerPoints(d.total_points ?? 0) }
                  } else { setCustomerPoints(0); setUsePoints(false) }
                }}
                placeholder={t.phonePlaceholder} type="tel"
                className="w-full border border-orange-100 rounded-xl px-3.5 py-2.5 text-sm bg-orange-50/50 placeholder-gray-300 focus:outline-none focus:border-orange-300 transition-colors" />
            </div>

            {/* Points redeem */}
            {customerPoints >= MIN_REDEEM && (
              <div className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 border transition-all ${usePoints ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-100'}`}>
                <div>
                  <p className="text-xs font-semibold text-gray-700">
                    {lang === 'th' ? `ใช้ ${customerPoints} แต้ม` : `Use ${customerPoints} pts`}
                    <span className="text-orange-500 ml-1">(-฿{customerPoints})</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {lang === 'th' ? `ลดราคาได้ ฿${customerPoints}` : `฿${customerPoints} discount`}
                  </p>
                </div>
                <button type="button" onClick={() => setUsePoints(u => !u)}
                  className={`w-11 h-6 rounded-full transition-all duration-200 ${usePoints ? 'bg-orange-400' : 'bg-gray-200'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mx-0.5 ${usePoints ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-500 rounded-xl px-4 py-2.5 text-sm font-medium mt-4">
            {error}
          </div>
        )}
      </div>

      {/* Fixed bottom */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur border-t border-orange-100">
        <div className="max-w-lg mx-auto">
          <button onClick={submitOrder} disabled={cart.length === 0 || loading}
            className={`flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[.98] ${cart.length > 0 ? 'bg-gradient-to-r from-orange-400 to-rose-400 text-white shadow-lg shadow-orange-200 hover:shadow-xl' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
            <ShoppingCart size={18} />
            {loading ? t.sending : cart.length > 0
              ? (existingOrderId ? t.addOrderBtn(total.toFixed(0)) : t.orderBtn(total.toFixed(0)))
              : t.selectItems}
          </button>
        </div>
      </div>
    </div>
  )
}

function MenuItemCard({ item, qty, onAdd, onRemove }: { item: MenuItem; qty: number; onAdd: () => void; onRemove: () => void }) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-all ${qty > 0 ? 'border-orange-300 shadow-orange-100' : 'border-orange-100'}`}>
      {/* Image */}
      <div className="aspect-square w-full bg-gradient-to-br from-orange-50 to-rose-50 overflow-hidden relative">
        {(item as any).image ? (
          <img src={(item as any).image} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🍽️</div>
        )}
        {qty > 0 && (
          <div className="absolute top-1.5 left-1.5 min-w-[20px] h-5 px-1 rounded-full bg-orange-400 text-white text-xs font-bold flex items-center justify-center shadow">
            {qty}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-2.5 pt-2 pb-1.5 flex-1">
        <p className="font-semibold text-xs text-gray-800 line-clamp-2 leading-tight">{item.name}</p>
        <p className="font-bold text-orange-500 text-xs mt-0.5">฿{item.price}</p>
      </div>

      {/* Action */}
      <div className="px-2 pb-2">
        {qty === 0 ? (
          <button
            onClick={onAdd}
            className="w-full py-2 rounded-xl bg-orange-400 hover:bg-orange-500 active:scale-95 text-white flex items-center justify-center gap-1 text-xs font-bold transition-all shadow-sm shadow-orange-200">
            <Plus size={13} strokeWidth={3} /> เพิ่ม
          </button>
        ) : (
          <div className="flex items-center justify-between bg-orange-50 rounded-xl border border-orange-200 p-1 gap-1">
            <button
              onClick={onRemove}
              className="w-7 h-7 rounded-lg bg-white border border-orange-100 flex items-center justify-center shadow-sm active:scale-90 transition-transform">
              <Minus size={12} className="text-orange-400" strokeWidth={2.5} />
            </button>
            <span className="font-bold text-sm text-orange-500 flex-1 text-center">{qty}</span>
            <button
              onClick={onAdd}
              className="w-7 h-7 rounded-lg bg-orange-400 flex items-center justify-center shadow-sm active:scale-90 transition-transform">
              <Plus size={12} className="text-white" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
