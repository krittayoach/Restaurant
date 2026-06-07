'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import { Plus, Eye, EyeOff, Trash2, X, Pencil, Tag, Check, ImagePlus } from 'lucide-react'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useConfirm } from '@/components/ConfirmModal'
import { useToast } from '@/components/Toast'

export default function MenuManagePage() {
  const params = useParams() as { slug: string }
  const [menus, setMenus] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [token, setToken] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showCats, setShowCats] = useState(false)
  const [filterCat, setFilterCat] = useState('all')
  const [form, setForm] = useState({ name: '', price: '', description: '', category_id: '', image: '' })
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const { confirm } = useConfirm()
  const toast = useToast()
  const [uploading, setUploading] = useState(false)
  const [catInput, setCatInput] = useState('')
  const [renamingCatId, setRenamingCatId] = useState<string | null>(null)
  const [renamingCatVal, setRenamingCatVal] = useState('')

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
    try { await api.patch(`/menus/${id}/toggle`, {}, token); load(token) }
    catch (e: any) { toast.error(e.message ?? 'เกิดข้อผิดพลาด') }
  }
  async function del(id: string) {
    if (!await confirm({ title: 'ลบเมนูนี้?', danger: true, confirmLabel: 'ลบ' })) return
    try { await api.delete(`/menus/${id}`, token); load(token) }
    catch (e: any) { toast.error(e.message ?? 'ลบไม่สำเร็จ') }
  }

  async function addCategory() {
    if (!catInput.trim()) return
    try { await api.post('/categories', { name: catInput.trim() }, token); setCatInput(''); load(token) }
    catch (e: any) { toast.error(e.message ?? 'เพิ่มหมวดหมู่ไม่สำเร็จ') }
  }
  async function deleteCategory(id: string) {
    if (!await confirm({ title: 'ลบหมวดหมู่นี้?', message: 'เมนูในหมวดนี้จะยังอยู่ (ไม่มีหมวด)', danger: true, confirmLabel: 'ลบ' })) return
    try { await api.delete(`/categories/${id}`, token); load(token) }
    catch (e: any) { toast.error(e.message ?? 'ลบไม่สำเร็จ') }
  }
  async function renameCategory(id: string) {
    if (!renamingCatVal.trim()) return
    try { await api.put(`/categories/${id}`, { name: renamingCatVal.trim() }, token); setRenamingCatId(null); load(token) }
    catch (e: any) { toast.error(e.message ?? 'แก้ไขไม่สำเร็จ') }
  }

  const PAGE_SIZE = 20
  const [page, setPage] = useState(1)
  const filtered = filterCat === 'all' ? menus : menus.filter(m => m.category_id === filterCat)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const catEmoji: Record<string, string> = { 'อาหารจานหลัก': '🍛', 'อาหารเรียกน้ำย่อย': '🍤', 'เครื่องดื่ม': '🥤', 'ของหวาน': '🍰' }

  if (pageLoading) return <LoadingScreen />

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 anim-up">
        <div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-text">🍽️ จัดการเมนู</h1>
          <p className="text-muted text-sm mt-0.5">ทั้งหมด {menus.length} รายการ</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCats(v => !v)} className="btn-secondary gap-1.5">
            <Tag size={15} /> หมวดหมู่
          </button>
          <button onClick={openAdd} className="btn-primary"><Plus size={16} /> เพิ่มเมนู</button>
        </div>
      </div>

      {/* Category management panel */}
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
                    <button onClick={() => renameCategory(c.id)} className="w-8 h-8 rounded-lg bg-green/10 text-green flex items-center justify-center hover:bg-green/20">
                      <Check size={14} />
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
                    <button onClick={() => deleteCategory(c.id)}
                      className="w-8 h-8 rounded-lg bg-rose/10 text-rose flex items-center justify-center hover:bg-rose/20">
                      <Trash2 size={13} />
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
            <button onClick={addCategory} className="btn-primary shrink-0"><Plus size={15} /> เพิ่ม</button>
          </div>
        </div>
      )}

      {/* Add / Edit form */}
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
              <button type="submit" className="btn-primary">{editingId ? 'บันทึกการแก้ไข' : 'บันทึก'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }} className="btn-secondary">ยกเลิก</button>
            </div>
          </form>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[{ id: 'all', name: 'ทั้งหมด' }, ...categories].map(c => (
          <button key={c.id} onClick={() => { setFilterCat(c.id); setPage(1) }}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${filterCat === c.id ? 'bg-accent text-white shadow-md shadow-accent/30' : 'bg-bg2 text-muted border border-border hover:border-border2'}`}>
            {(catEmoji[c.name] ?? '') + ' ' + c.name}
          </button>
        ))}
      </div>

      {/* Menu grid — 4 cards per row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {paginated.map((menu: any, i: number) => (
          <div key={menu.id} className={`card card-hover flex flex-col anim-up overflow-hidden ${!menu.is_available ? 'opacity-50' : ''} ${editingId === menu.id ? 'ring-2 ring-accent/40' : ''}`}
            style={{ animationDelay: `${i * 20}ms` }}>
            {/* Image */}
            <div className="w-full aspect-square bg-bg3 relative overflow-hidden">
              {menu.image ? (
                <img src={menu.image} alt={menu.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">
                  {catEmoji[categories.find((c: any) => c.id === menu.category_id)?.name] ?? '🍴'}
                </div>
              )}
              {/* availability badge */}
              <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${menu.is_available ? 'bg-green' : 'bg-rose'}`} title={menu.is_available ? 'เปิดขาย' : 'ปิดขาย'} />
            </div>
            {/* Info */}
            <div className="p-2.5 flex-1 flex flex-col">
              <p className="font-semibold text-xs leading-tight line-clamp-2 mb-0.5">{menu.name}</p>
              <p className="text-xs text-muted truncate mb-1.5">
                {categories.find((c: any) => c.id === menu.category_id)?.name ?? 'ไม่มีหมวดหมู่'}
              </p>
              <p className="font-bold text-accent text-sm mt-auto">฿{menu.price}</p>
            </div>
            {/* Actions */}
            <div className="flex border-t border-border">
              <button onClick={() => openEdit(menu)} className="flex-1 py-2 text-blue hover:bg-blue/5 transition-colors flex items-center justify-center" title="แก้ไข">
                <Pencil size={13} />
              </button>
              <button onClick={() => toggle(menu.id)} className={`flex-1 py-2 transition-colors flex items-center justify-center ${menu.is_available ? 'text-green hover:bg-green/5' : 'text-muted hover:bg-bg3'}`} title={menu.is_available ? 'เปิดขาย' : 'ปิดขาย'}>
                {menu.is_available ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <button onClick={() => del(menu.id)} className="flex-1 py-2 text-rose hover:bg-rose/5 transition-colors flex items-center justify-center">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-4 card p-12 text-center text-muted text-sm">🍽️ ยังไม่มีเมนูในหมวดนี้</div>}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-bg2 border border-border text-muted hover:bg-border disabled:opacity-40 transition-colors">
            ← ก่อน
          </button>
          <span className="text-sm text-muted">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-bg2 border border-border text-muted hover:bg-border disabled:opacity-40 transition-colors">
            ถัดไป →
          </button>
        </div>
      )}
    </div>
  )
}
