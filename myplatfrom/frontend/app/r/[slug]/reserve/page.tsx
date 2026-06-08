'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Calendar, Clock, Users, User, Phone, FileText, ChevronRight, Plus, Minus, ShoppingCart, ImagePlus, Upload } from 'lucide-react'
import { useI18n, LangToggle } from '@/lib/i18n'
import QRCode from 'qrcode'
import { Spinner } from '@/components/Spinner'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function toLocalDate(d: Date) { return d.toISOString().slice(0, 10) }

interface MenuItem { id: string; name: string; price: number; category_id?: string; image?: string }
interface CartItem extends MenuItem { quantity: number; note?: string }

export default function ReservePage() {
  const { slug } = useParams() as { slug: string }
  const router   = useRouter()
  const { t, lang, setLang } = useI18n()
  const today = toLocalDate(new Date())

  // Step 1 — Search
  const [date, setDate]           = useState(today)
  const [time, setTime]           = useState('19:00')
  const [partySize, setPartySize] = useState('2')
  const [tables, setTables]       = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Step 2+3 — Table + Info
  const [step, setStep] = useState<'search' | 'form'>('search')
  const [selectedTable, setSelectedTable] = useState<any>(null)
  const [name, setName]   = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ table?: string; name?: string; phone?: string }>({})

  // Step 4 — Pre-order
  const [menus, setMenus]         = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [cart, setCart]           = useState<CartItem[]>([])
  const [restaurant, setRestaurant] = useState<any>(null)
  const [promptpayQR, setPromptpayQR] = useState('')

  // Step 5 — Payment
  const [slipPreview, setSlipPreview] = useState('')
  const [payError, setPayError] = useState('')

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState('')

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const needPayment = cart.length > 0

  const addItem    = (item: MenuItem) => setCart(c => c.find(i => i.id === item.id) ? c.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i) : [...c, { ...item, quantity: 1 }])
  const removeItem = (id: string)     => setCart(c => c.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0))
  const getQty     = (id: string)     => cart.find(i => i.id === id)?.quantity ?? 0

  async function searchTables() {
    setSearching(true); setSearchError(''); setTables([]); setSelectedTable(null)
    try {
      const res = await fetch(`${API}/reservations/public/${slug}/tables?date=${date}&time=${time}&party_size=${partySize}`)
      const data = await res.json()
      if (!res.ok) { setSearchError(data.error ?? t.connectionError); return }
      setTables(data)
      if (data.length === 0) { setSearchError(t.noTablesError); return }

      // Load menus + restaurant info in parallel
      const [restRes, menuRes, catRes] = await Promise.all([
        fetch(`${API}/restaurants/${slug}`).then(r => r.json()).catch(() => null),
        fetch(`${API}/menus?restaurantId=${data[0]?.restaurant_id ?? ''}`).then(r => r.json()).catch(() => []),
        fetch(`${API}/categories?restaurantId=${data[0]?.restaurant_id ?? ''}`).then(r => r.json()).catch(() => []),
      ])

      // get restaurant_id from tables endpoint if needed
      let rid = data[0]?.restaurant_id
      if (!rid && restRes?.id) rid = restRes.id
      const [menuRes2, catRes2] = rid
        ? await Promise.all([
            fetch(`${API}/menus?restaurantId=${rid}`).then(r => r.json()).catch(() => menuRes),
            fetch(`${API}/categories?restaurantId=${rid}`).then(r => r.json()).catch(() => catRes),
          ])
        : [menuRes, catRes]

      setRestaurant(restRes)
      setMenus(Array.isArray(menuRes2) ? menuRes2 : menuRes)
      setCategories(Array.isArray(catRes2) ? catRes2 : catRes)

      if (restRes?.promptpay) {
        const img = await QRCode.toDataURL(restRes.promptpay, { width: 200, margin: 2, color: { dark: '#7c2d12', light: '#ffffff' } })
        setPromptpayQR(img)
      }
      setStep('form')
    } catch {
      setSearchError(t.connectionError)
    } finally {
      setSearching(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setSlipPreview(ev.target?.result as string); setPayError('') }
    reader.readAsDataURL(file)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof fieldErrors = {}
    if (!selectedTable) errs.table = t.selectTableError
    if (!name.trim())   errs.name  = t.enterNameError
    if (phone.replace(/\D/g, '').length < 9) errs.phone = t.enterPhoneError
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    if (needPayment && !slipPreview) { setPayError(t.tapToSelectSlip); return }

    setSubmitting(true); setFormError('')
    try {
      const preOrderItems = cart.map(i => ({
        menu_id: i.id, menu_name: i.name, unit_price: i.price, quantity: i.quantity,
        ...(i.note ? { note: i.note } : {}),
      }))
      const res = await fetch(`${API}/reservations/public/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id:       selectedTable.id,
          customer_name:  name.trim(),
          customer_phone: phone.trim(),
          party_size:     parseInt(partySize),
          date, time,
          notes: notes.trim() || undefined,
          ...(preOrderItems.length > 0 ? { pre_order_items: preOrderItems, pre_order_slip: slipPreview } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? t.connectionError); return }
      router.push(`/r/${slug}/reserve/confirm?id=${data.id}`)
    } catch {
      setFormError(t.cannotBookError)
    } finally {
      setSubmitting(false)
    }
  }

  const grouped = categories
    .map((cat: any) => ({ ...cat, items: menus.filter(m => m.category_id === cat.id) }))
    .filter(cat => cat.items.length > 0)
  const uncategorized = menus.filter(m => !m.category_id)

  return (
    <div className="min-h-screen bg-bg2 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 relative">
          <div className="absolute right-0 top-1"><LangToggle lang={lang} setLang={setLang} /></div>
          <h1 className="font-display font-bold text-3xl text-text">{t.reserveTitle}</h1>
          <p className="text-muted text-sm mt-1">{t.reserveSubtitle}</p>
        </div>

        {/* Cancel warning */}
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-700 font-medium">
          {t.cancelWarning}
        </div>

        {/* Step 1: Search */}
        <div className="card p-6 mb-4">
          <p className="text-sm font-semibold text-text mb-4">{t.step1}</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5"><Calendar size={12} />{t.dateLabel}</label>
              <input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5"><Clock size={12} />{t.timeLabel}</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5"><Users size={12} />{t.partySizeLabel}</label>
              <select value={partySize} onChange={e => setPartySize(e.target.value)} className="input w-full">
                {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{t.persons(n)}</option>)}
              </select>
            </div>
            {searchError && <p className="text-red-500 text-sm">{searchError}</p>}
            <button onClick={searchTables} disabled={searching}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-70">
              {searching ? <><Spinner size={16} />{t.searching}</> : <><span>{t.searchTables}</span><ChevronRight size={16} /></>}
            </button>
          </div>
        </div>

        {step === 'form' && tables.length > 0 && (
          <form onSubmit={submit} className="space-y-4">
            {/* Step 2: Table */}
            <div className="card p-6">
              <p className="text-sm font-semibold text-text mb-3">{t.step2}</p>
              <div className={`grid grid-cols-2 gap-2 rounded-xl transition-all ${fieldErrors.table ? 'ring-2 ring-red-400 ring-offset-1' : ''}`}>
                {tables.map(tb => (
                  <button key={tb.id} type="button"
                    onClick={() => { setSelectedTable(tb); setFieldErrors(fe => ({ ...fe, table: undefined })) }}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${selectedTable?.id === tb.id ? 'border-accent bg-accent/10' : 'border-border bg-bg3 hover:border-accent/50'}`}>
                    <p className="font-bold text-text">{tb.label}</p>
                    <p className="text-xs text-muted flex items-center gap-1 mt-0.5"><Users size={10} />{tb.seats} {t.seats}</p>
                  </button>
                ))}
              </div>
              {fieldErrors.table && <p className="text-red-500 text-xs mt-1.5">{fieldErrors.table}</p>}
            </div>

            {/* Step 3: Booker info */}
            <div className="card p-6">
              <p className="text-sm font-semibold text-text mb-4">{t.step3}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5"><User size={12} />{t.fullName} *</label>
                  <input value={name} onChange={e => { setName(e.target.value); setFieldErrors(fe => ({ ...fe, name: undefined })) }}
                    placeholder={t.namePlaceholder}
                    className={`input w-full ${fieldErrors.name ? 'border-red-400 bg-red-50' : ''}`} />
                  {fieldErrors.name && <p className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>}
                </div>
                <div>
                  <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5"><Phone size={12} />{t.phone} *</label>
                  <input value={phone} onChange={e => { setPhone(e.target.value); setFieldErrors(fe => ({ ...fe, phone: undefined })) }}
                    placeholder={t.phonePlaceholder} type="tel"
                    className={`input w-full ${fieldErrors.phone ? 'border-red-400 bg-red-50' : ''}`} />
                  {fieldErrors.phone && <p className="text-red-500 text-xs mt-1">{fieldErrors.phone}</p>}
                </div>
                <div>
                  <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5"><FileText size={12} />{t.notes}</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder={t.notesPlaceholder} rows={2} className="input w-full resize-none" />
                </div>
              </div>
            </div>

            {/* Step 4: Pre-order */}
            <div className="card p-6">
              <p className="text-sm font-semibold text-text">{t.step4}</p>
              <p className="text-xs text-muted mt-0.5 mb-4">{t.step4sub}</p>

              {menus.length === 0 ? (
                <p className="text-xs text-muted text-center py-4">{t.preOrderEmpty}</p>
              ) : (
                <div className="space-y-4">
                  {/* Category groups */}
                  {grouped.map((cat: any) => (
                    <div key={cat.id}>
                      <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2">{cat.name}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {cat.items.map((item: MenuItem) => (
                          <MiniMenuCard key={item.id} item={item} qty={getQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {uncategorized.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {uncategorized.map((item: MenuItem) => (
                        <MiniMenuCard key={item.id} item={item} qty={getQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item.id)} />
                      ))}
                    </div>
                  )}

                  {/* Cart summary */}
                  {cart.length > 0 && (
                    <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 space-y-2 mt-2">
                      {cart.map(i => (
                        <div key={i.id} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 text-gray-700 font-medium">{i.name}</span>
                          <span className="text-gray-400">×{i.quantity}</span>
                          <span className="font-bold text-orange-500">฿{(i.price * i.quantity).toFixed(0)}</span>
                        </div>
                      ))}
                      <div className="border-t border-orange-200 pt-2 flex justify-between font-bold text-sm">
                        <span className="text-gray-600">{t.total}</span>
                        <span className="text-orange-500">฿{cartTotal.toFixed(0)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 5: Payment (only if cart has items) */}
            {needPayment && (
              <div className="card p-6">
                <p className="text-sm font-semibold text-text">{t.paymentStep}</p>
                <p className="text-xs text-muted mt-0.5 mb-4">{t.paymentStepSub(cartTotal.toFixed(0))}</p>

                {restaurant?.promptpay ? (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-orange-50 to-rose-50 rounded-2xl p-4 text-center border border-orange-100">
                      {promptpayQR && (
                        <div className="flex justify-center mb-3">
                          <div className="bg-white rounded-2xl p-2 shadow-md border border-orange-100">
                            <img src={promptpayQR} alt="PromptPay QR" className="w-36 h-36 rounded-lg" />
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mb-1">PromptPay</p>
                      <p className="font-mono font-bold text-gray-800 text-lg">{restaurant.promptpay}</p>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-orange-400 mb-2">{t.attachSlip}</p>
                      <label className={`flex flex-col items-center gap-2 border-2 border-dashed rounded-2xl p-4 cursor-pointer transition-colors ${slipPreview ? 'border-orange-300 bg-orange-50/50' : payError ? 'border-red-300 bg-red-50/30' : 'border-orange-200 hover:border-orange-300'}`}>
                        {slipPreview ? (
                          <img src={slipPreview} alt="slip" className="max-h-40 rounded-xl object-contain" />
                        ) : (
                          <>
                            <ImagePlus size={24} className={payError ? 'text-red-300' : 'text-orange-300'} />
                            <span className={`text-sm ${payError ? 'text-red-400' : 'text-gray-400'}`}>{t.tapToSelectSlip}</span>
                          </>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                      </label>
                      {payError && <p className="text-red-500 text-xs mt-1">{payError}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
                    <p className="text-sm text-amber-700">ร้านยังไม่ได้ตั้งค่า PromptPay — กรุณาติดต่อร้านก่อนจอง</p>
                  </div>
                )}
              </div>
            )}

            {formError && <p className="text-red-500 text-sm text-center">{formError}</p>}

            <button type="submit" disabled={submitting || (needPayment && !restaurant?.promptpay)}
              className="btn-primary w-full py-3 text-base disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <><Spinner size={16} />{t.booking}</> : t.confirmBooking}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function MiniMenuCard({ item, qty, onAdd, onRemove }: { item: MenuItem; qty: number; onAdd: () => void; onRemove: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-orange-100 shadow-sm overflow-hidden flex flex-col">
      <div className="aspect-square w-full bg-gradient-to-br from-orange-50 to-rose-50 overflow-hidden relative">
        {item.image
          ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
        }
        {qty > 0 && (
          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-orange-400 text-white text-xs font-bold flex items-center justify-center shadow">
            {qty}
          </div>
        )}
      </div>
      <div className="p-1.5 flex-1">
        <p className="font-semibold text-xs text-gray-800 line-clamp-2 leading-tight">{item.name}</p>
        <p className="font-bold text-orange-500 text-xs mt-0.5">฿{item.price}</p>
      </div>
      <div className="flex border-t border-orange-50">
        {qty > 0 ? (
          <>
            <button type="button" onClick={onRemove} className="flex-1 py-1 flex items-center justify-center text-orange-400 hover:bg-orange-50">
              <Minus size={11} />
            </button>
            <button type="button" onClick={onAdd} className="flex-1 py-1 flex items-center justify-center bg-gradient-to-r from-orange-400 to-rose-400 text-white">
              <Plus size={11} />
            </button>
          </>
        ) : (
          <button type="button" onClick={onAdd} className="w-full py-1 flex items-center justify-center bg-gradient-to-r from-orange-400 to-rose-400 text-white rounded-b-xl">
            <Plus size={11} />
          </button>
        )}
      </div>
    </div>
  )
}
