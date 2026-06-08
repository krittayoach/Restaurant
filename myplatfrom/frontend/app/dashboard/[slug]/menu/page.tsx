'use client'
import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import { Plus, Eye, EyeOff, Trash2, X, Pencil, Tag, Check, ImagePlus, Search } from 'lucide-react'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useConfirm } from '@/components/ConfirmModal'
import { useToast } from '@/components/Toast'
import { Spinner } from '@/components/Spinner'

export default function MenuManagePage() {
  const params = useParams() as { slug: string }
  const [menus, setMenus] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [token, setToken] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showCats, setShowCats] = useState(false)
  const [filterCat, setFilterCat] = useState('all')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', price: '', description: '', category_id: '', image: '' })
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const { confirm } = useConfirm()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [catInput, setCatInput] = useState('')
  const [catSaving, setCatSaving] = useState(false)
  const [renamingCatId, setRenamingCatId] = useState<string | null>(null)
  const [renamingCatVal, setRenamingCatVal] = useState('')
  const [busyId, setBusyId] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const t = getToken()
    setToken(t); load(t)
  }, [])

  async function load(t: string) {
    const rid = await api.get(`/restaurants/${params.slug}`, t).then((r: any) => r.id).catch(() => '')
    const [m, c] = await Promise.all([
      api.get('/menus/all', t).catch(() => []),
      api.get(`/categories?restaurantId=${rid}`).catch(() => []),
    ])
    setMenus(m); setCategories(c); setPageLoading(false)
  }

  function openAdd() {
    setEditingId(null)
    setForm({ name: '', price: '', description: '', category_id: '', image: '' })
    setFormSubmitted(false)
    setShowForm(true)
  }

  function openEdit(menu: any) {
    setEditingId(menu.id)
    setForm({ name: menu.name, price: String(menu.price), description: menu.description ?? '', category_id: menu.category_id ?? '', image: menu.image ?? '' })
    setFormSubmitted(false)
    setShowForm(true)
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    setFormSubmitted(true)
    if (!form.name || !form.price) return
    const payload = { ...form, price: parseFloat(form.price) }
    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/menus/${editingId}`, payload, token)
      } else {
        await api.post('/menus', payload, token)
      }
      setShowForm(false); setFormSubmitted(false); setEditingId(null)
      setForm({ name: '', price: '', description: '', category_id: '', image: '' })
      load(token)
    } catch (e: any) { toast.error(e.message ?? 'บันทึกไม่สำเร็จ') }
    finally { setSaving(false) }
  }

  async function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/menus/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) throw new Error('upload failed')
      const { url } = await res.json()
      setForm(f => ({ ...f, image: url }))
    } catch {
      toast.error('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setUploading(false)
    }
  }

  async function toggle(id: string) {
    setBusyId(b => ({ ...b, [id]: true }))
    try { await api.patch(`/menus/${id}/toggle`, {}, token); load(token) }
    catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
    finally { setBusyId(b => ({ ...b, [id]: false })) }
  }
  async function del(id: string) {
    if (!await confirm({ title: 'ลบเมนูนี้?', danger: true, confirmLabel: 'ลบ' })) return
    setBusyId(b => ({ ...b, [id]: true }))
    try { await api.delete(`/menus/${id}`, token); load(token) }
    catch (e: any) { toast.error(e.message ?? 'ลบไม่สำเร็จ') }
    finally { setBusyId(b => ({ ...b, [id]: false })) }
  }

  async function addCategory() {
    if (!catInput.trim()) return
    setCatSaving(true)
    try { await api.post('/categories', { name: catInput.trim() }, token); setCatInput(''); load(token) }
    catch (e: any) { toast.error(e.message ?? 'เพิ่มหมวดหมู่ไม่สำเร็จ') }
    finally { setCatSaving(false) }
  }
  async function deleteCategory(id: string) {
    if (!await confirm({ title: 'ลบหมวดหมู่นี้?', message: 'เมนูในหมวดนี้จะยังอยู่ (ไม่มีหมวด)', danger: true, confirmLabel: 'ลบ' })) return
    setBusyId(b => ({ ...b, [id]: true }))
    try { await api.delete(`/categories/${id}`, token); load(token) }
    catch (e: any) { toast.error(e.message ?? 'ลบไม่สำเร็จ') }
    finally { setBusyId(b => ({ ...b, [id]: false })) }
  }
  async function renameCategory(id: string) {
    if (!renamingCatVal.trim()) return
    setBusyId(b => ({ ...b, [id]: true }))
    try { await api.put(`/categories/${id}`, { name: renamingCatVal.trim() }, token); setRenamingCatId(null); load(token) }
    catch (e: any) { toast.error(e.message ?? 'แก้ไขไม่สำเร็จ') }
    finally { setBusyId(b => ({ ...b, [id]: false })) }
  }

  const catEmoji: Record<string, string> = { 'อาหารจานหลัก': '🍛', 'อาหารเรียกน้ำย่อย': '🍤', 'เครื่องดื่ม': '🥤', 'ของหวาน': '🍰' }

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q
      ? menus.filter(m => m.name.toLowerCase().includes(q) || (m.description ?? '').toLowerCase().includes(q))
      : menus

    const pool = filterCat === 'all' ? base : base.filter(m => m.category_id === filterCat)

    if (filterCat !== 'all') {
      const cat = categories.find((c: any) => c.id === filterCat)
      return cat ? [{ category: cat, items: pool }] : []
    }

    const result: { category: any; items: any[] }[] = []
    for (const cat of categories) {
      const items = pool.filter((m: any) => m.category_id === cat.id)
      if (items.length > 0) result.push({ category: cat, items })
    }
    const uncategorized = pool.filter((m: any) => !categories.find((c: any) => c.id === m.category_id))
    if (uncategorized.length > 0) result.push({ category: { id: '__none', name: 'ไม่มีหมวดหมู่' }, items: uncategorized })

    return result
  }, [menus, categories, filterCat, search])

  const totalVisible = menus.filter(m => m.is_available).length
  const totalHidden  = menus.length - totalVisible

  if (pageLoading) return <LoadingScreen />

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 anim-up gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-text">จัดการเมนู</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-muted text-sm">{menus.length} รายการ</span>
            {totalVisible > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-green/10 text-green font-medium">{totalVisible} เปิดขาย</span>}
            {totalHidden  > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-bg3 text-muted font-medium">{totalHidden} ปิด</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowCats(v => !v)} className="btn-secondary gap-1.5">
            <Tag size={15} /> หมวดหมู่
          </button>
          <button onClick={openAdd} className="btn-primary gap-1.5"><Plus size={16} /> เพิ่มเมนู</button>
        </div>
      </div>

      {/* ── Category management panel ── */}
      {showCats && (
        <div className="card p-5 mb-6 anim-pop">
          <div className="flex items-center justify-between mb-4">
            <p className="font-display font-semibold text-base">จัดการหมวดหมู่</p>
            <button onClick={() => setShowCats(false)} className="text-muted hover:text-text"><X size={18} /></button>
          </div>
          <div className="space-y-2 mb-4">
            {categories.map((c: any) => (
              <div key={c.id} className="flex items-center gap-2 p-2 rounded-xl bg-bg3">
                {renamingCatId === c.id ? (
                  <>
                    <input value={renamingCatVal} onChange={e => setRenamingCatVal(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && renameCategory(c.id)}
                      className="input py-1.5 text-sm flex-1" autoFocus />
                    <button onClick={() => renameCategory(c.id)} disabled={busyId[c.id]} className="w-8 h-8 rounded-lg bg-green/10 text-green flex items-center justify-center hover:bg-green/20 disabled:opacity-50">
                      {busyId[c.id] ? <Spinner size={13} /> : <Check size={14} />}
                    </button>
                    <button onClick={() => setRenamingCatId(null)} className="w-8 h-8 rounded-lg bg-bg2 text-muted flex items-center justify-center">
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{catEmoji[c.name] ?? '📂'} {c.name}</span>
                    <span className="text-xs text-muted">{menus.filter(m => m.category_id === c.id).length} เมนู</span>
                    <button onClick={() => { setRenamingCatId(c.id); setRenamingCatVal(c.name) }}
                      className="w-8 h-8 rounded-lg bg-bg2 text-muted flex items-center justify-center hover:text-text">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => deleteCategory(c.id)} disabled={busyId[c.id]}
                      className="w-8 h-8 rounded-lg bg-rose/10 text-rose flex items-center justify-center hover:bg-rose/20 disabled:opacity-50">
                      {busyId[c.id] ? <Spinner size={13} /> : <Trash2 size={13} />}
                    </button>
                  </>
                )}
              </div>
            ))}
            {categories.length === 0 && <p className="text-muted text-sm text-center py-2">ยังไม่มีหมวดหมู่</p>}
          </div>
          <div className="flex gap-2">
            <input value={catInput} onChange={e => setCatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              placeholder="ชื่อหมวดหมู่ใหม่" className="input flex-1" />
            <button onClick={addCategory} disabled={catSaving} className="btn-primary shrink-0 gap-1 disabled:opacity-70">
              {catSaving ? <Spinner size={14} /> : <Plus size={15} />} เพิ่ม
            </button>
          </div>
        </div>
      )}

      {/* ── Add / Edit form ── */}
      {showForm && (
        <div className="card p-5 md:p-6 mb-6 anim-pop">
          <div className="flex items-center justify-between mb-4">
            <p className="font-display font-semibold text-base">{editingId ? '✏️ แก้ไขเมนู' : 'เพิ่มเมนูใหม่'}</p>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="text-muted hover:text-text"><X size={18} /></button>
          </div>
          <form onSubmit={submitForm} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1.5 ml-1">ชื่อเมนู <span className="text-rose">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ผัดกระเพรา"
                  className={`input ${formSubmitted && !form.name ? 'input-error' : ''}`} />
                {formSubmitted && !form.name && <p className="field-error">กรุณากรอกชื่อเมนู</p>}
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 ml-1">ราคา (฿) <span className="text-rose">*</span></label>
                <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="70"
                  className={`input ${formSubmitted && !form.price ? 'input-error' : ''}`} />
                {formSubmitted && !form.price && <p className="field-error">กรุณากรอกราคา</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5 ml-1">คำอธิบาย</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="อร่อย เผ็ดกำลังดี" className="input" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5 ml-1">หมวดหมู่</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="input">
                <option value="">— ไม่ระบุ —</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5 ml-1">รูปภาพ</label>
              <label className={`flex items-center gap-3 border-2 border-dashed rounded-xl p-3 cursor-pointer transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''} ${form.image ? 'border-accent/40 bg-accent/5' : 'border-border hover:border-accent/40'}`}>
                {uploading ? (
                  <div className="w-14 h-14 rounded-lg bg-bg3 flex items-center justify-center shrink-0">
                    <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : form.image ? (
                  <img src={form.image} alt="preview" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-bg3 flex items-center justify-center shrink-0">
                    <ImagePlus size={20} className="text-muted" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted">{uploading ? 'กำลังอัปโหลด...' : form.image ? 'เปลี่ยนรูปภาพ' : 'เลือกรูปภาพ'}</p>
                  <p className="text-xs text-muted/60 mt-0.5">JPG, PNG ไม่เกิน 2MB</p>
                </div>
                {form.image && !uploading && (
                  <button type="button" onClick={e => { e.preventDefault(); setForm(f => ({ ...f, image: '' })) }}
                    className="text-muted hover:text-rose transition-colors shrink-0">
                    <X size={16} />
                  </button>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={onImageChange} disabled={uploading} />
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary gap-2 disabled:opacity-70">
                {saving ? <><Spinner size={14} /> กำลังบันทึก...</> : (editingId ? 'บันทึกการแก้ไข' : 'บันทึก')}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }} className="btn-secondary" disabled={saving}>ยกเลิก</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Search + Category filter ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาเมนู..."
            className="input pl-9 w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{ id: 'all', name: 'ทั้งหมด' }, ...categories].map(c => (
            <button key={c.id} onClick={() => setFilterCat(c.id)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${filterCat === c.id ? 'bg-accent text-white shadow-md shadow-accent/30' : 'bg-bg2 text-muted border border-border hover:border-border2'}`}>
              {(catEmoji[(c as any).name] ?? '') + ' ' + c.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grouped sections ── */}
      {grouped.length === 0 ? (
        <div className="card p-12 text-center text-muted text-sm">
          {search ? `ไม่พบเมนูที่ค้นหา "${search}"` : '🍽️ ยังไม่มีเมนูในหมวดนี้'}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ category, items }) => (
            <section key={category.id} className="anim-up">
              {/* section header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">{catEmoji[category.name] ?? (category.id === '__none' ? '📦' : '📂')}</span>
                  <h2 className="font-display font-bold text-base text-text">{category.name}</h2>
                  <span className="text-xs font-medium text-muted bg-bg3 px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="flex-1 h-px bg-border" />
              </div>
              {/* items grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {items.map((menu: any, i: number) => (
                  <div key={menu.id}
                    className={`card card-hover flex flex-col overflow-hidden anim-up ${!menu.is_available ? 'opacity-50' : ''} ${editingId === menu.id ? 'ring-2 ring-accent/40' : ''}`}
                    style={{ animationDelay: `${i * 15}ms` }}>
                    {/* image */}
                    <div className="w-full aspect-square bg-bg3 relative overflow-hidden">
                      {menu.image ? (
                        <img src={menu.image} alt={menu.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">
                          {catEmoji[category.name] ?? '🍴'}
                        </div>
                      )}
                      <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${menu.is_available ? 'bg-green' : 'bg-rose'}`} />
                    </div>
                    {/* info */}
                    <div className="p-2.5 flex-1 flex flex-col">
                      <p className="font-semibold text-xs leading-tight line-clamp-2 mb-1">{menu.name}</p>
                      {menu.description && (
                        <p className="text-xs text-muted/70 line-clamp-1 mb-1">{menu.description}</p>
                      )}
                      <p className="font-bold text-accent text-sm mt-auto">฿{menu.price}</p>
                    </div>
                    {/* actions */}
                    <div className="flex border-t border-border">
                      <button onClick={() => openEdit(menu)} className="flex-1 py-2 text-blue hover:bg-blue/5 transition-colors flex items-center justify-center" title="แก้ไข">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => toggle(menu.id)} disabled={busyId[menu.id]}
                        className={`flex-1 py-2 transition-colors flex items-center justify-center disabled:opacity-50 ${menu.is_available ? 'text-green hover:bg-green/5' : 'text-muted hover:bg-bg3'}`}
                        title={menu.is_available ? 'เปิดขาย' : 'ปิดขาย'}>
                        {busyId[menu.id] ? <Spinner size={12} /> : menu.is_available ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button onClick={() => del(menu.id)} disabled={busyId[menu.id]} className="flex-1 py-2 text-rose hover:bg-rose/5 transition-colors flex items-center justify-center disabled:opacity-50">
                        {busyId[menu.id] ? <Spinner size={12} /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
