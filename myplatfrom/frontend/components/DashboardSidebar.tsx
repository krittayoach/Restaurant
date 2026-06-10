'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, UtensilsCrossed, ClipboardList,
  ChefHat, QrCode, Tag, Users, BarChart3, LogOut, Settings, Monitor, Package, CreditCard,
  GitBranch, ChevronDown, ChevronLeft,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useConfirm } from './ConfirmModal'

type Branch = { id: string; name: string; slug: string; is_active: boolean }

const NAV = [
  { href: '',            label: 'ภาพรวม',     emoji: '🏠', icon: LayoutDashboard, roles: ['manager'] },
  { href: '/menu',       label: 'เมนู',        emoji: '🍽️', icon: UtensilsCrossed, roles: ['manager', 'employee'] },
  { href: '/orders',     label: 'หน้าร้าน',    emoji: '🪑', icon: ClipboardList,   roles: ['manager', 'employee'] },
  { href: '/kitchen',    label: 'ครัว',        emoji: '👨‍🍳', icon: ChefHat,         roles: ['manager', 'chef'] },
  { href: '/tables/qr',  label: 'QR โต๊ะ',    emoji: '📱', icon: QrCode,          roles: ['manager'] },
  { href: '/payments',   label: 'ชำระเงิน',   emoji: '💳', icon: CreditCard,      roles: ['manager', 'employee'] },
  { href: '/promotions', label: 'โปรโมชั่น',   emoji: '🎁', icon: Tag,             roles: ['manager'] },
  { href: '/employees',  label: 'พนักงาน',     emoji: '👥', icon: Users,           roles: ['manager'] },
  { href: '/inventory',  label: 'คลังวัตถุดิบ', emoji: '📦', icon: Package,         roles: ['manager'] },
  { href: '/reports',    label: 'รายงาน',      emoji: '📊', icon: BarChart3,       roles: ['manager'] },
  { href: '/branches',   label: 'สาขา',        emoji: '🏪', icon: GitBranch,       roles: ['manager'], hideInBranch: true },
  { href: '/settings',   label: 'ตั้งค่า',     emoji: '⚙️', icon: Settings,        roles: ['manager'] },
]

const ROLE_LABEL: Record<string, string> = {
  manager: 'ผู้จัดการ', employee: 'พนักงาน', chef: 'พ่อครัว', super_admin: 'Super Admin',
}

export default function DashboardSidebar({
  slug, restaurantName, role, branches = [], parentSlug, parentName,
}: {
  slug: string
  restaurantName: string
  role: string
  branches?: Branch[]
  parentSlug?: string | null
  parentName?: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { confirm } = useConfirm()
  const [branchOpen, setBranchOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  const isBranch = !!parentSlug
  const nav = NAV.filter(n => n.roles.includes(role) && (!(n as any).hideInBranch || !isBranch))

  const isActive = (href: string) => {
    const full = `/dashboard/${slug}${href}`
    return href === '' ? pathname === full : pathname.startsWith(full)
  }

  async function switchToBranch(branchSlug: string) {
    setSwitching(true)
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
      }
    } finally { setSwitching(false) }
  }

  async function switchToParent() {
    setSwitching(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/switch-parent`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        const { restaurantSlug } = await res.json()
        window.location.href = `/dashboard/${restaurantSlug}`
      }
    } finally { setSwitching(false) }
  }

  async function handleLogout() {
    const ok = await confirm({
      title: 'ออกจากระบบ?',
      message: 'คุณต้องการออกจากระบบใช่ไหม',
      danger: true,
      confirmLabel: 'ออกจากระบบ',
    })
    if (!ok) return
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
    router.push('/login')
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col h-full bg-bg2/80 backdrop-blur border-r border-border">
        <div className="px-5 py-4 border-b border-border space-y-3">
          {isBranch && (
            <button
              onClick={switchToParent}
              disabled={switching}
              className="flex items-center gap-1 text-xs text-muted hover:text-text transition-colors disabled:opacity-50"
            >
              <ChevronLeft size={13} />
              <span className="truncate">{parentName}</span>
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-accent flex items-center justify-center text-xl shadow-lg shadow-accent/30">
              🍜
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-base text-text truncate leading-tight">{restaurantName}</p>
              <p className="text-xs text-muted">{isBranch ? 'สาขา' : 'ระบบจัดการร้าน'}</p>
            </div>
          </div>
          {!isBranch && branches.length > 0 && (
            <div>
              <button
                onClick={() => setBranchOpen(o => !o)}
                className="flex items-center gap-1.5 w-full text-xs font-medium text-muted hover:text-text transition-colors"
              >
                <GitBranch size={12} />
                <span>{branches.length} สาขา</span>
                <ChevronDown size={12} className={cn('ml-auto transition-transform duration-200', branchOpen && 'rotate-180')} />
              </button>
              {branchOpen && (
                <div className="mt-2 space-y-1">
                  {branches.map(b => (
                    <div key={b.id} className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-bg3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text truncate">{b.name}</p>
                        <p className="text-[10px] text-muted font-mono">{b.slug}</p>
                      </div>
                      <button
                        onClick={() => switchToBranch(b.slug)}
                        disabled={!b.is_active || switching}
                        className="ml-2 text-[11px] font-medium text-accent hover:underline disabled:text-muted disabled:no-underline shrink-0"
                      >
                        {b.is_active ? 'เข้า →' : 'ปิด'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(item => {
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={`/dashboard/${slug}${item.href}`}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all',
                  active
                    ? 'bg-accent text-white shadow-lg shadow-accent/30'
                    : 'text-muted hover:bg-bg3 hover:text-text'
                )}>
                <span className="text-base w-5 text-center">{item.emoji}</span>
                {item.label}
              </Link>
            )
          })}
          {(role === 'chef' || role === 'manager') && (
            <a href={`/kds/${slug}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium text-muted hover:bg-bg3 hover:text-text transition-all">
              <Monitor size={16} className="w-5" />
              KDS จอครัว ↗
            </a>
          )}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="size-9 rounded-full bg-bg3 flex items-center justify-center text-sm">
              {role === 'chef' ? '👨‍🍳' : role === 'employee' ? '🧑‍💼' : '👔'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">{ROLE_LABEL[role] ?? role}</p>
              <p className="text-xs text-muted font-mono truncate">{slug.slice(0, 14)}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-2xl text-sm font-medium text-muted hover:bg-rose/10 hover:text-rose transition-all">
            <LogOut size={15} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-bg2/90 backdrop-blur border-b border-border px-4 h-14 flex items-center justify-between pt-safe">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-accent flex items-center justify-center text-base">🍜</div>
          <p className="font-display font-semibold text-sm truncate max-w-[160px]">{restaurantName}</p>
        </div>
        <button
          onClick={handleLogout}
          aria-label="ออกจากระบบ"
          className="size-9 rounded-xl bg-bg3 flex items-center justify-center text-muted active:scale-90 transition-transform">
          <LogOut size={16} />
        </button>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-bg2/95 backdrop-blur border-t border-border px-1.5 py-1.5 flex items-center gap-0.5 overflow-x-auto pb-safe">
        {nav.map(item => {
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={`/dashboard/${slug}${item.href}`}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl min-w-[58px] transition-all',
                active ? 'bg-accent/10 text-accent' : 'text-muted'
              )}>
              <span className="text-base">{item.emoji}</span>
              <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
