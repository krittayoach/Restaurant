'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api, getToken } from '@/lib/api'
import { GitBranch, Plus, X, ExternalLink, AlertCircle } from 'lucide-react'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useToast } from '@/components/Toast'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'
import { useConfirm } from '@/components/ConfirmModal'
import { useDashboardLang } from '@/lib/i18n-dashboard'

type Branch = { id: string; name: string; slug: string; is_active: boolean; created_at: string }

export default function BranchesPage() {
  const { slug } = useParams() as { slug: string }
  const { t } = useDashboardLang()
  const toast = useToast()
  const { confirm } = useConfirm()

  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchLimit, setBranchLimit] = useState(0)
  const [isBranch, setIsBranch] = useState(false)
  const [parentSlug, setParentSlug] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '' })
  const [creating, setCreating] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)

  useEffect(() => {
    const t = getToken()
    setToken(t)
    Promise.all([
      api.get(`/restaurants/${slug}`, t),
      api.get(`/restaurants/${slug}/branches`, t).catch(() => null),
    ]).then(([restaurant, branchData]: any[]) => {
      if (restaurant.parent_slug) {
        setIsBranch(true)
        setParentSlug(restaurant.parent_slug)
      } else if (branchData) {
        setBranches(branchData.branches ?? [])
        setBranchLimit(branchData.branch_limit ?? 0)
      }
    }).finally(() => setLoading(false))
  }, [slug])

  async function createBranch(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.slug.trim()) return
    setCreating(true)
    try {
      const res = await api.post(`/restaurants/${slug}/branches`, { name: form.name.trim(), slug: form.slug.trim() }, token)
      setBranches(prev => [...prev, { ...res.branch, is_active: true, created_at: new Date().toISOString() }])
      setForm({ name: '', slug: '' })
      setShowCreate(false)
      toast.success('สร้างสาขาเรียบร้อยแล้ว')
    } catch (err: any) {
      toast.error(err.message ?? 'สร้างสาขาไม่สำเร็จ')
    } finally { setCreating(false) }
  }

  async function deactivateBranch(branchSlug: string, branchName: string) {
    const ok = await confirm({
      title: t.branches.closeBranchTitle,
      message: `"${branchName}"`,
      danger: true,
      confirmLabel: t.branches.closeBranch,
    })
    if (!ok) return
    try {
      await api.delete(`/restaurants/${slug}/branches/${branchSlug}`, token)
      setBranches(prev => prev.map(b => b.slug === branchSlug ? { ...b, is_active: false } : b))
      toast.success('ปิดสาขาเรียบร้อยแล้ว')
    } catch (err: any) {
      toast.error(err.message ?? 'เกิดข้อผิดพลาด')
    }
  }

  async function enterBranch(branchSlug: string) {
    setSwitching(branchSlug)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/switch-branch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ branchSlug }),
      })
      if (res.ok) {
        const { restaurantSlug } = await res.json()
        window.location.href = `/dashboard/${restaurantSlug}`
      } else {
        toast.error('เข้าสาขาไม่สำเร็จ')
      }
    } finally { setSwitching(null) }
  }

  if (loading) return <LoadingScreen />

  if (isBranch) {
    return (
      <div className="p-5 md:p-8 max-w-2xl mx-auto">
        <div className="card p-6 text-center space-y-3">
          <GitBranch size={28} className="mx-auto text-muted" />
          <p className="font-semibold text-text">{t.branches.isBranch}</p>
          <p className="text-sm text-muted">{t.branches.isBranchSub}</p>
          {parentSlug && (
            <a href={`/dashboard/${parentSlug}/branches`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              {t.branches.goToParent} <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
    )
  }

  const atLimit = branchLimit !== -1 && branches.length >= branchLimit
  const canCreate = branchLimit === -1 || branches.length < branchLimit

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="anim-up flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-text text-balance">{t.branches.title}</h1>
          <p className="text-muted text-sm mt-0.5">
            {branchLimit === -1 ? `${branches.length} สาขา (ไม่จำกัด)` : `${branches.length} / ${branchLimit} สาขา`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={!canCreate}
          aria-label={t.branches.createBranch}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-accent text-white text-sm font-medium shadow-lg shadow-accent/30 hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Plus size={16} /> {t.branches.createBranch}
        </button>
      </div>

      {/* Plan limit warning */}
      {atLimit && branchLimit > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow/10 border border-yellow/20 anim-up">
          <AlertCircle size={16} className="text-yellow mt-0.5 shrink-0" />
          <p className="text-sm text-text">
            {t.branches.limitReached} — <a href={`/dashboard/${slug}/settings`} className="text-accent font-medium hover:underline">{t.branches.upgradeLink}</a>
          </p>
        </div>
      )}

      {/* No plan — free */}
      {branchLimit === 0 && (
        <div className="card p-8 text-center space-y-3 anim-up">
          <GitBranch size={28} className="mx-auto text-muted" />
          <p className="font-semibold text-text">{t.branches.freeNotSupported}</p>
          <p className="text-sm text-muted">{t.branches.freeUpgradeSub}</p>
          <a href={`/dashboard/${slug}/settings`}
            className="inline-block mt-1 px-4 py-2 rounded-2xl bg-accent text-white text-sm font-medium shadow-lg shadow-accent/30 hover:bg-accent/90 transition-all">
            {t.branches.upgrade}
          </a>
        </div>
      )}

      {/* Branch list */}
      {branches.length > 0 && (
        <div className="space-y-3 anim-up">
          {branches.map((b, i) => (
            <div key={b.id} className="card card-hover p-4 flex items-center gap-4" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="size-10 rounded-2xl bg-accent/10 flex items-center justify-center text-lg shrink-0">
                🏪
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-text truncate">{b.name}</p>
                  {!b.is_active && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-rose/10 text-rose shrink-0">{t.branches.closedBadge}</span>
                  )}
                </div>
                <p className="text-xs text-muted font-mono">{b.slug}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {b.is_active && (
                  <button
                    onClick={() => enterBranch(b.slug)}
                    disabled={switching === b.slug}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg3 text-xs font-medium text-text hover:bg-accent/10 hover:text-accent transition-all disabled:opacity-50"
                  >
                    {switching === b.slug ? <Spinner className="size-3" /> : <ExternalLink size={12} />}
                    {t.branches.enterBranch}
                  </button>
                )}
                {b.is_active && (
                  <button
                    onClick={() => deactivateBranch(b.slug, b.name)}
                    aria-label={t.branches.closeBranch}
                    className="size-8 rounded-xl flex items-center justify-center text-muted hover:bg-rose/10 hover:text-rose transition-all"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
          <div className="card w-full max-w-sm p-6 space-y-5 anim-up">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-text">{t.branches.createTitle}</h2>
              <button onClick={() => setShowCreate(false)} aria-label="ปิด" className="size-8 rounded-xl flex items-center justify-center text-muted hover:bg-bg3 transition-all">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={createBranch} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">{t.branches.branchName}</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="เช่น สาขาสุขุมวิท"
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">{t.branches.slugLabel}</label>
                <input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                  placeholder="เช่น my-restaurant-sukhumvit"
                  className="input w-full font-mono"
                  required
                />
                {form.slug && (
                  <p className="text-[11px] text-muted mt-1">URL: /dashboard/{form.slug}</p>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-border text-sm font-medium text-muted hover:bg-bg3 transition-all">
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={creating || !form.name || !form.slug}
                  className="flex-1 py-2.5 rounded-2xl bg-accent text-white text-sm font-medium shadow-lg shadow-accent/30 hover:bg-accent/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {creating ? <Spinner className="size-4" /> : <Plus size={15} />}
                  {creating ? t.branches.creating : t.branches.createBranch}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
