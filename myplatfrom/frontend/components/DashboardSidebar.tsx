'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, UtensilsCrossed, ClipboardList,
  ChefHat, QrCode, Tag, Users, BarChart3, LogOut, Settings, Monitor,
} from 'lucide-react'

const NAV = [
  { href: '',            label: 'ภาพรวม',     emoji: '🏠', icon: LayoutDashboard, roles: ['manager'] },
  { href: '/menu',       label: 'เมนู',        emoji: '🍽️', icon: UtensilsCrossed, roles: ['manager', 'employee'] },
  { href: '/orders',     label: 'หน้าร้าน',    emoji: '🪑', icon: ClipboardList,   roles: ['manager', 'employee'] },
  { href: '/kitchen',    label: 'ครัว',        emoji: '👨‍🍳', icon: ChefHat,         roles: ['manager', 'chef'] },
  { href: '/tables/qr',  label: 'QR โต๊ะ',    emoji: '📱', icon: QrCode,          roles: ['manager'] },
  { href: '/promotions', label: 'โปรโมชั่น',   emoji: '🎁', icon: Tag,             roles: ['manager'] },
  { href: '/employees',  label: 'พนักงาน',     emoji: '👥', icon: Users,           roles: ['manager'] },
  { href: '/reports',    label: 'รายงาน',      emoji: '📊', icon: BarChart3,       roles: ['manager'] },
  { href: '/settings',   label: 'ตั้งค่า',     emoji: '⚙️', icon: Settings,        roles: ['manager'] },
]

const ROLE_LABEL: Record<string, string> = {
  manager: 'ผู้จัดการ', employee: 'พนักงาน', chef: 'พ่อครัว', super_admin: 'Super Admin',
}

export default function DashboardSidebar({ slug, restaurantName, role }: { slug: string; restaurantName: string; role: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const nav = NAV.filter(n => n.roles.includes(role))
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  async function confirmLogout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
    router.push('/login')
  }

  const isActive = (href: string) => {
    const full = `/dashboard/${slug}${href}`
    return href === '' ? pathname === full : pathname.startsWith(full)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col h-full bg-bg2/80 backdrop-blur border-r border-border">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent to-rose flex items-center justify-center text-xl shadow-lg shadow-accent/30">
              🍜
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-base text-text truncate leading-tight">{restaurantName}</p>
              <p className="text-xs text-muted">ระบบจัดการร้าน</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(item => {
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={`/dashboard/${slug}${item.href}`}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-gradient-to-r from-accent to-accent2 text-white shadow-lg shadow-accent/30'
                    : 'text-muted hover:bg-bg3 hover:text-text'
                }`}>
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
            <div className="w-9 h-9 rounded-full bg-bg3 flex items-center justify-center text-sm">
              {role === 'chef' ? '👨‍🍳' : role === 'employee' ? '🧑‍💼' : '👔'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">{ROLE_LABEL[role] ?? role}</p>
              <p className="text-xs text-muted font-mono truncate">{slug.slice(0, 14)}</p>
            </div>
          </div>
          <button onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-2xl text-sm font-medium text-muted hover:bg-rose/10 hover:text-rose transition-all">
            <LogOut size={15} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-bg2/90 backdrop-blur border-b border-border px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-rose flex items-center justify-center text-base">🍜</div>
          <p className="font-display font-semibold text-sm truncate max-w-[160px]">{restaurantName}</p>
        </div>
        <button onClick={() => setShowLogoutModal(true)} className="w-9 h-9 rounded-xl bg-bg3 flex items-center justify-center text-muted active:scale-90 transition-transform">
          <LogOut size={16} />
        </button>
      </div>

      {/* Logout confirmation modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogoutModal(false)}>
          <div className="bg-bg2 border border-border rounded-3xl p-6 w-full max-w-sm shadow-2xl anim-pop" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-rose/10 mx-auto mb-4">
              <LogOut size={24} className="text-rose" />
            </div>
            <h3 className="font-display font-bold text-lg text-center text-text mb-1">ออกจากระบบ?</h3>
            <p className="text-sm text-muted text-center mb-6">คุณต้องการออกจากระบบใช่ไหม</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutModal(false)}
                className="flex-1 btn-secondary">
                ยกเลิก
              </button>
              <button onClick={confirmLogout}
                className="flex-1 py-2.5 rounded-2xl bg-rose text-white text-sm font-semibold hover:bg-rose/90 transition-colors">
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-bg2/95 backdrop-blur border-t border-border px-1.5 py-1.5 flex items-center gap-0.5 overflow-x-auto">
        {nav.map(item => {
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={`/dashboard/${slug}${item.href}`}
              className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl min-w-[58px] transition-all ${
                active ? 'bg-accent/10 text-accent' : 'text-muted'
              }`}>
              <span className="text-base">{item.emoji}</span>
              <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
