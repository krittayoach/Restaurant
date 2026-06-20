'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import { Plus, Pencil, Trash2, X, Check, AlertTriangle, Package, ChevronDown, ChevronUp } from 'lucide-react'
import { useConfirm } from '@/components/ConfirmModal'
import { useToast } from '@/components/Toast'
import { LoadingScreen } from '@/components/LoadingScreen'
import { Spinner } from '@/components/Spinner'
import { useDashboardLang } from '@/lib/i18n-dashboard'

const UNITS = ['กรัม', 'กิโลกรัม', 'มิลลิลิตร', 'ลิตร', 'ชิ้น', 'แผ่น', 'ถุง', 'กล่อง']

export default function InventoryPage() {
  const params = useParams() as { slug: string }
  const { t } = useDashboardLang()
  const [ingredients, setIngredients] = useState<any[]>([])
  const [menus, setMenus]             = useState<any[]>([])
  const [recipes, setRecipes]         = useState<Record<string, any[]>>({})
  const [token, setToken]             = useState('')
  const [loading, setLoading]         = useState(true)
  const [showAdd, setShowAdd]         = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null)
  const { confirm } = useConfirm()
  const toast = useToast()

  const [addForm, setAddForm] = useState({ name: '', unit: 'กรัม', quantity: '', low_threshold: '' })
  const [editForm, setEditForm] = useState({ name: '', unit: '', quantity: '', low_threshold: '' })
  const [adjustId, setAdjustId] = useState<string | null>(null)
  const [adjustDelta, setAdjustDelta] = useState('')
  const [recipeMenuId, setRecipeMenuId] = useState<string | null>(null)
  const [recipeItems, setRecipeItems] = useState<{ ingredient_id: string; quantity_per_unit: string }[]>([])
  const [addSaving, setAddSaving] = useState(false)
  const [recipeSaving, setRecipeSaving] = useState(false)
  const [busyId, setBusyId] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const t = getToken(); setToken(t); loadAll(t)
  }, [])

  async function loadAll(t: string) {
    const [ing, mnu] = await Promise.all([
      api.get('/inventory', t).catch(() => []),
      api.get('/menus', t).catch(() => []),
    ])
    setIngredients(ing ?? [])
    setMenus((mnu ?? []).filter((m: any) => !m.is_deleted))
    setLoading(false)
  }

  async function loadRecipe(menuId: string) {
    if (recipes[menuId]) return
    const data = await api.get(`/inventory/recipe/${menuId}`, token).catch(() => [])
    setRecipes(r => ({ ...r, [menuId]: data ?? [] }))
  }

  async function addIngredient(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.name || !addForm.unit) return
    setAddSaving(true)
    try {
      await api.post('/inventory', {
        name: addForm.name, unit: addForm.unit,
        quantity: parseFloat(addForm.quantity) || 0,
        low_threshold: parseFloat(addForm.low_threshold) || 0,
      }, token)
      setAddForm({ name: '', unit: 'กรัม', quantity: '', low_threshold: '' })
      setShowAdd(false)
      loadAll(token)
      toast.success('เพิ่มวัตถุดิบแล้ว')
    } catch (e: any) { toast.error(e.message) }
    finally { setAddSaving(false) }
  }

  async function saveEdit(id: string) {
    setBusyId(b => ({ ...b, [id]: true }))
    try {
      await api.patch(`/inventory/${id}`, {
        name: editForm.name, unit: editForm.unit,
        quantity: parseFloat(editForm.quantity),
        low_threshold: parseFloat(editForm.low_threshold),
      }, token)
      setEditingId(null); loadAll(token); toast.success('บันทึกแล้ว')
    } catch (e: any) { toast.error(e.message) }
    finally { setBusyId(b => ({ ...b, [id]: false })) }
  }

  async function deleteIngredient(id: string, name: string) {
    if (!await confirm({ title: `ลบ "${name}"?`, danger: true, confirmLabel: 'ลบ' })) return
    setBusyId(b => ({ ...b, [`del_${id}`]: true }))
    try { await api.delete(`/inventory/${id}`, token); loadAll(token); toast.success('ลบแล้ว') }
    catch (e: any) { toast.error(e.message) }
    finally { setBusyId(b => ({ ...b, [`del_${id}`]: false })) }
  }

  async function adjust(id: string) {
    const delta = parseFloat(adjustDelta)
    if (isNaN(delta) || delta === 0) return
    setBusyId(b => ({ ...b, [`adj_${id}`]: true }))
    try {
      await api.post(`/inventory/${id}/adjust`, { delta }, token)
      setAdjustId(null); setAdjustDelta(''); loadAll(token)
    } catch (e: any) { toast.error(e.message) }
    finally { setBusyId(b => ({ ...b, [`adj_${id}`]: false })) }
  }

  async function saveRecipe(menuId: string) {
    setRecipeSaving(true)
    try {
      await api.put(`/inventory/recipe/${menuId}`, {
        items: recipeItems
          .filter(r => r.ingredient_id && parseFloat(r.quantity_per_unit) > 0)
          .map(r => ({ ingredient_id: r.ingredient_id, quantity_per_unit: parseFloat(r.quantity_per_unit) }))
      }, token)
      setRecipes(r => ({ ...r, [menuId]: undefined as any }))
      await loadRecipe(menuId)
      setRecipeMenuId(null)
      toast.success('บันทึก recipe แล้ว')
    } catch (e: any) { toast.error(e.message) }
    finally { setRecipeSaving(false) }
  }

  const lowStock = ingredients.filter(i => i.quantity <= i.low_threshold && i.low_threshold > 0)

  if (loading) return <LoadingScreen />

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-text">{t.inventory.title}</h1>
          <p className="text-muted text-sm mt-0.5">{ingredients.length} {t.common.items}</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="btn-primary flex items-center gap-1.5">
          <Plus size={15} /> {t.inventory.addIngredient}
        </button>
      </div>

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div className="card p-4 mb-5 border-rose/30 bg-rose/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-rose" />
            <p className="text-sm font-semibold text-rose">{t.inventory.lowStock} ({lowStock.length} {t.common.items})</p>
          </div>
          <div className="space-y-1.5">
            {lowStock.map(i => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <span className="text-text">{i.name}</span>
                <span className="text-rose font-semibold">{i.quantity} {i.unit} ({t.inventory.below} {i.low_threshold})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-text">{t.inventory.addNew}</p>
            <button onClick={() => setShowAdd(false)} className="text-muted hover:text-text"><X size={16} /></button>
          </div>
          <form onSubmit={addIngredient} className="grid grid-cols-2 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="text-xs text-muted mb-1 block">{t.inventory.ingredientName} *</label>
              <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="เช่น เนื้อหมู" className="input w-full" autoFocus />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">{t.inventory.unit} *</label>
              <select value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} className="input w-full">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">{t.inventory.initialQty}</label>
              <input type="number" value={addForm.quantity} onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0" min="0" step="0.1" className="input w-full" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">{t.inventory.alertBelow}</label>
              <input type="number" value={addForm.low_threshold} onChange={e => setAddForm(f => ({ ...f, low_threshold: e.target.value }))}
                placeholder="0" min="0" step="0.1" className="input w-full" />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAdd(false)} disabled={addSaving} className="btn-secondary">{t.common.cancel}</button>
              <button type="submit" disabled={addSaving} className="btn-primary gap-2 disabled:opacity-70">
                {addSaving ? <><Spinner size={14} /> {t.inventory.adding}</> : t.common.add}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ingredients table */}
      <div className="card overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-bg3 text-muted text-xs">
            <tr>
              <th className="text-left px-4 py-3">{t.inventory.colName}</th>
              <th className="text-right px-4 py-3">{t.inventory.colQty}</th>
              <th className="text-right px-4 py-3">{t.inventory.colAlert}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ingredients.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">{t.inventory.noIngredients}</td></tr>
            )}
            {ingredients.map(ing => {
              const isLow = ing.low_threshold > 0 && ing.quantity <= ing.low_threshold
              const isEditing = editingId === ing.id
              return (
                <tr key={ing.id} className={isLow ? 'bg-rose/5' : ''}>
                  {isEditing ? (
                    <>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="input py-1.5 text-sm flex-1" autoFocus />
                          <select value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} className="input py-1.5 text-sm w-28">
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} className="input py-1.5 text-sm w-24 ml-auto block" step="0.1" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" value={editForm.low_threshold} onChange={e => setEditForm(f => ({ ...f, low_threshold: e.target.value }))} className="input py-1.5 text-sm w-24 ml-auto block" step="0.1" />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => saveEdit(ing.id)} disabled={busyId[ing.id]} data-tooltip="บันทึก" className="p-1.5 bg-green/10 text-green rounded-lg hover:bg-green/20 disabled:opacity-50">
                            {busyId[ing.id] ? <Spinner size={13} /> : <Check size={14} />}
                          </button>
                          <button onClick={() => setEditingId(null)} disabled={busyId[ing.id]} data-tooltip="ยกเลิก" className="p-1.5 bg-bg3 text-muted rounded-lg hover:bg-border"><X size={14} /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isLow && <AlertTriangle size={13} className="text-rose shrink-0" />}
                          <span className="font-medium text-text">{ing.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {adjustId === ing.id ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <input type="number" value={adjustDelta} onChange={e => setAdjustDelta(e.target.value)}
                              placeholder="+100 หรือ -50" className="input py-1 text-xs w-28 text-right" step="0.1" autoFocus />
                            <button onClick={() => adjust(ing.id)} disabled={busyId[`adj_${ing.id}`]} data-tooltip="ยืนยัน" className="p-1.5 bg-green/10 text-green rounded-lg hover:bg-green/20 disabled:opacity-50">
                              {busyId[`adj_${ing.id}`] ? <Spinner size={12} /> : <Check size={13} />}
                            </button>
                            <button onClick={() => { setAdjustId(null); setAdjustDelta('') }} disabled={busyId[`adj_${ing.id}`]} data-tooltip="ยกเลิก" className="p-1.5 bg-bg3 text-muted rounded-lg"><X size={13} /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setAdjustId(ing.id); setAdjustDelta('') }}
                            className={`font-semibold hover:underline ${isLow ? 'text-rose' : 'text-text'}`}>
                            {ing.quantity} {ing.unit}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">{ing.low_threshold} {ing.unit}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => { setEditingId(ing.id); setEditForm({ name: ing.name, unit: ing.unit, quantity: String(ing.quantity), low_threshold: String(ing.low_threshold) }) }}
                            data-tooltip="แก้ไข" className="p-1.5 bg-blue/10 text-blue rounded-lg hover:bg-blue/20"><Pencil size={13} /></button>
                          <button onClick={() => deleteIngredient(ing.id, ing.name)} disabled={busyId[`del_${ing.id}`]}
                            data-tooltip="ลบ" className="p-1.5 bg-rose/10 text-rose rounded-lg hover:bg-rose/20 disabled:opacity-50">
                            {busyId[`del_${ing.id}`] ? <Spinner size={12} /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recipe per menu */}
      <div>
        <h2 className="font-display font-bold text-lg text-text mb-4 flex items-center gap-2">
          <Package size={18} className="text-accent" /> {t.inventory.recipe}
        </h2>
        <div className="space-y-2">
          {menus.map(menu => {
            const isExpanded = expandedMenu === menu.id
            const recipe = recipes[menu.id] ?? []
            return (
              <div key={menu.id} className="card overflow-hidden">
                <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-bg3 transition-colors"
                  onClick={async () => {
                    if (!isExpanded) await loadRecipe(menu.id)
                    setExpandedMenu(isExpanded ? null : menu.id)
                  }}>
                  <span className="font-medium text-text text-sm">{menu.name}</span>
                  <div className="flex items-center gap-2">
                    {recipe.length > 0 && <span className="text-xs text-muted">{recipe.length} วัตถุดิบ</span>}
                    {isExpanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border">
                    {recipeMenuId === menu.id ? (
                      <div className="pt-3 space-y-2">
                        {recipeItems.map((item, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <select value={item.ingredient_id}
                              onChange={e => setRecipeItems(r => r.map((ri, idx) => idx === i ? { ...ri, ingredient_id: e.target.value } : ri))}
                              className="input py-1.5 text-sm flex-1">
                              <option value="">{t.inventory.selectIngredient}</option>
                              {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
                            </select>
                            <input type="number" value={item.quantity_per_unit} placeholder="ปริมาณ"
                              onChange={e => setRecipeItems(r => r.map((ri, idx) => idx === i ? { ...ri, quantity_per_unit: e.target.value } : ri))}
                              className="input py-1.5 text-sm w-24" step="0.1" min="0" />
                            <button onClick={() => setRecipeItems(r => r.filter((_, idx) => idx !== i))}
                              className="p-1.5 text-muted hover:text-rose"><X size={14} /></button>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setRecipeItems(r => [...r, { ingredient_id: '', quantity_per_unit: '' }])}
                            className="text-xs text-accent hover:underline flex items-center gap-1"><Plus size={12} />{t.inventory.addIngredient}</button>
                          <div className="ml-auto flex gap-2">
                            <button onClick={() => setRecipeMenuId(null)} disabled={recipeSaving} className="btn-secondary text-xs py-1.5 px-3">{t.common.cancel}</button>
                            <button onClick={() => saveRecipe(menu.id)} disabled={recipeSaving} className="btn-primary text-xs py-1.5 px-3 gap-1.5 disabled:opacity-70">
                              {recipeSaving ? <><Spinner size={12} />{t.common.saving}</> : t.common.save}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-3">
                        {recipe.length === 0
                          ? <p className="text-muted text-sm">{t.inventory.noRecipe}</p>
                          : <div className="space-y-1 mb-3">
                              {recipe.map((r: any) => (
                                <div key={r.id} className="flex items-center justify-between text-sm">
                                  <span className="text-text">{r.name}</span>
                                  <span className="text-muted">{r.quantity_per_unit} {r.unit}</span>
                                </div>
                              ))}
                            </div>
                        }
                        <button onClick={() => {
                          setRecipeMenuId(menu.id)
                          setRecipeItems((recipes[menu.id] ?? []).map((r: any) => ({
                            ingredient_id: r.ingredient_id,
                            quantity_per_unit: String(r.quantity_per_unit),
                          })))
                        }} className="text-xs text-accent hover:underline flex items-center gap-1">
                          <Pencil size={11} /> แก้ไข recipe
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
