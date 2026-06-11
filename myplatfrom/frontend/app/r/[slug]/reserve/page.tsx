'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Calendar, Clock, Users, User, Phone, FileText, ChevronRight, Plus, Minus, ImagePlus } from 'lucide-react'
import { useI18n, LangToggle } from '@/lib/i18n'
import QRCode from 'qrcode'
import { Spinner } from '@/components/Spinner'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010'

function toLocalDate(d: Date) { return d.toISOString().slice(0, 10) }

interface MenuItem { id: string; name: string; price: number; category_id?: string; image?: string; description?: string }
interface CartItem extends MenuItem { quantity: number; note?: string }

export default function ReservePage() {
  const { slug } = useParams() as { slug: string }
  const router   = useRouter()
  const { t, lang, setLang } = useI18n()
  const today = toLocalDate(new Date())

  const [date, setDate]           = useState(today)
  const [time, setTime]           = useState('19:00')
  const [partySize, setPartySize] = useState('2')
  const [tables, setTables]       = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const [step, setStep] = useState<'search' | 'form'>('search')
  const [selectedTable, setSelectedTable] = useState<any>(null)
  const [name, setName]   = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ table?: string; name?: string; phone?: string }>({})

  const [menus, setMenus]           = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [cart, setCart]             = useState<CartItem[]>([])
  const [restaurant, setRestaurant] = useState<any>(null)
  const [promptpayQR, setPromptpayQR] = useState('')

  const [slipPreview, setSlipPreview] = useState('')
  const [payError, setPayError] = useState('')

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

      const [restRes, menuRes, catRes] = await Promise.all([
        fetch(`${API}/restaurants/${slug}`).then(r => r.json()).catch(() => null),
        fetch(`${API}/menus?restaurantId=${data[0]?.restaurant_id ?? ''}`).then(r => r.json()).catch(() => []),
        fetch(`${API}/categories?restaurantId=${data[0]?.restaurant_id ?? ''}`).then(r => r.json()).catch(() => []),
      ])

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
        <div className="mb-4 bg-yellow/10 border border-yellow/30 rounded-2xl px-4 py-3 text-xs text-yellow font-medium">
          {t.cancelWarning}
        </div>

        {/* Step 1 */}
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
            {searchError && <p className="text-rose text-sm">{searchError}</p>}
            <button onClick={searchTables} disabled={searching}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-70">
              {searching ? <><Spinner size={16} />{t.searching}</> : <><span>{t.searchTables}</span><ChevronRight size={16} /></>}
            </button>
          </div>
        </div>

        {step === 'form' && tables.length > 0 && (
          <form onSubmit={submit} className="space-y-4">
            {/* Step 2 */}
            <div className="card p-6">
              <p className="text-sm font-semibold text-text mb-3">{t.step2}</p>
              <div className={`grid grid-cols-2 gap-2 rounded-xl transition-all ${fieldErrors.table ? 'ring-2 ring-rose ring-offset-1' : ''}`}>
                {tables.map(tb => (
                  <button key={tb.id} type="button"
                    onClick={() => { setSelectedTable(tb); setFieldErrors(fe => ({ ...fe, table: undefined })) }}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${selectedTable?.id === tb.id ? 'border-accent bg-accent/10' : 'border-border bg-bg3 hover:border-accent/50'}`}>
                    <p className="font-bold text-text">{tb.label}</p>
                    <p className="text-xs text-muted flex items-center gap-1 mt-0.5"><Users size={10} />{tb.seats} {t.seats}</p>
                  </button>
                ))}
              </div>
              {fieldErrors.table && <p className="text-rose text-xs mt-1.5">{fieldErrors.table}</p>}
            </div>

            {/* Step 3 */}
            <div className="card p-6">
              <p className="text-sm font-semibold text-text mb-4">{t.step3}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5"><User size={12} />{t.fullName} *</label>
                  <input value={name} onChange={e => { setName(e.target.value); setFieldErrors(fe => ({ ...fe, name: undefined })) }}
                    placeholder={t.namePlaceholder}
                    className={`input w-full ${fieldErrors.name ? 'border-rose bg-rose/5' : ''}`} />
                  {fieldErrors.name && <p className="text-rose text-xs mt-1">{fieldErrors.name}</p>}
                </div>
                <div>
                  <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5"><Phone size={12} />{t.phone} *</label>
                  <input value={phone} onChange={e => { setPhone(e.target.value); setFieldErrors(fe => ({ ...fe, phone: undefined })) }}
                    placeholder={t.phonePlaceholder} type="tel"
                    className={`input w-full ${fieldErrors.phone ? 'border-rose bg-rose/5' : ''}`} />
                  {fieldErrors.phone && <p className="text-rose text-xs mt-1">{fieldErrors.phone}</p>}
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
                  {grouped.map((cat: any) => (
                    <div key={cat.id}>
                      <p className="text-xs font-bold text-accent uppercase tracking-wider mb-2">{cat.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {cat.items.map((item: MenuItem) => (
                          <MiniMenuCard key={item.id} item={item} qty={getQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {uncategorized.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {uncategorized.map((item: MenuItem) => (
                        <MiniMenuCard key={item.id} item={item} qty={getQty(item.id)} onAdd={() => addItem(item)} onRemove={() => removeItem(item.id)} />
                      ))}
                    </div>
                  )}

                  {cart.length > 0 && (
                    <div className="bg-bg3 rounded-xl p-3 border border-border space-y-2 mt-2">
                      {cart.map(i => (
                        <div key={i.id} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 text-text font-medium">{i.name}</span>
                          <span className="text-muted">×{i.quantity}</span>
                          <span className="font-bold text-accent">฿{(i.price * i.quantity).toFixed(0)}</span>
                        </div>
                      ))}
                      <div className="border-t border-border pt-2 flex justify-between font-bold text-sm">
                        <span className="text-text">{t.total}</span>
                        <span className="text-accent">฿{cartTotal.toFixed(0)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 5: Payment */}
            {needPayment && (
              <div className="card p-6">
                <p className="text-sm font-semibold text-text">{t.paymentStep}</p>
                <p className="text-xs text-muted mt-0.5 mb-4">{t.paymentStepSub(cartTotal.toFixed(0))}</p>

                {restaurant?.promptpay ? (
                  <div className="space-y-4">
                    <div className="bg-bg3 rounded-2xl p-4 text-center border border-border">
                      {promptpayQR && (
                        <div className="flex justify-center mb-3">
                          <div className="bg-bg2 rounded-2xl p-2 shadow-md border border-border">
                            <img src={promptpayQR} alt="PromptPay QR" className="w-36 h-36 rounded-lg" />
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-muted mb-1">PromptPay</p>
                      <p className="font-mono font-bold text-text text-lg">{restaurant.promptpay}</p>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-accent mb-2">{t.attachSlip}</p>
                      <label className={`flex flex-col items-center gap-2 border-2 border-dashed rounded-2xl p-4 cursor-pointer transition-colors ${slipPreview ? 'border-accent/50 bg-bg3' : payError ? 'border-rose/50 bg-rose/5' : 'border-border2 hover:border-accent/50'}`}>
                        {slipPreview ? (
                          <img src={slipPreview} alt="slip" className="max-h-40 rounded-xl object-contain" />
                        ) : (
                          <>
                            <ImagePlus size={24} className={payError ? 'text-rose' : 'text-muted'} />
                            <span className={`text-sm ${payError ? 'text-rose' : 'text-muted'}`}>{t.tapToSelectSlip}</span>
                          </>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                      </label>
                      {payError && <p className="text-rose text-xs mt-1">{payError}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow/10 rounded-xl p-4 text-center border border-yellow/20">
                    <p className="text-sm text-yellow">ร้านยังไม่ได้ตั้งค่า PromptPay — กรุณาติดต่อร้านก่อนจอง</p>
                  </div>
                )}
              </div>
            )}

            {formError && <p className="text-rose text-sm text-center">{formError}</p>}

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
    <div className="bg-bg2 rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
      <div className="aspect-[4/3] w-full bg-bg3 overflow-hidden relative">
        {item.image
          ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
        }
        {qty > 0 && (
          <div className="absolute top-1.5 left-1.5 size-5 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shadow">
            {qty}
          </div>
        )}
      </div>
      <div className="px-2.5 pt-2 pb-1 flex-1">
        <p className="font-semibold text-xs text-text line-clamp-2 leading-snug">{item.name}</p>
        {item.description && <p className="text-xs text-muted mt-0.5 line-clamp-1">{item.description}</p>}
        <p className="font-bold text-accent text-xs mt-0.5">฿{item.price}</p>
      </div>
      <div className="flex border-t border-border">
        {qty > 0 ? (
          <>
            <button type="button" onClick={onRemove} aria-label="ลด"
              className="flex-1 py-1.5 flex items-center justify-center text-accent hover:bg-bg3 transition-colors">
              <Minus size={11} />
            </button>
            <button type="button" onClick={onAdd} aria-label="เพิ่ม"
              className="flex-1 py-1.5 flex items-center justify-center bg-accent text-white">
              <Plus size={11} />
            </button>
          </>
        ) : (
          <button type="button" onClick={onAdd} aria-label="เพิ่ม"
            className="w-full py-1.5 flex items-center justify-center bg-accent text-white rounded-b-xl">
            <Plus size={11} />
          </button>
        )}
      </div>
    </div>
  )
}
