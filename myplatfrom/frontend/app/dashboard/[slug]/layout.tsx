import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify } from 'jose'
import DashboardSidebar from '@/components/DashboardSidebar'
import PlanLimitModal from '@/components/PlanLimitModal'
import { DashboardLangProvider } from '@/lib/i18n-dashboard'
import { ShieldOff } from 'lucide-react'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export default async function DashboardLayout({
  children, params,
}: { children: React.ReactNode; params: { slug: string } }) {
  const token = cookies().get('session')?.value
  if (!token) redirect('/login')

  let role = 'manager'
  try {
    const { payload } = await jwtVerify(token, secret) as { payload: any }
    role = payload.role
  } catch { redirect('/login') }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/restaurants/${params.slug}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  })
  const restaurant = res.ok ? await res.json() : { name: params.slug, branches: [], parent_slug: null, parent_name: null }

  if (restaurant.is_active === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-rose/10 flex items-center justify-center mx-auto">
            <ShieldOff size={28} className="text-rose" />
          </div>
          <div>
            <p className="font-display font-bold text-xl text-text">ร้านนี้ถูกระงับการใช้งาน</p>
            <p className="text-sm text-muted mt-1">{restaurant.name}</p>
          </div>
          {restaurant.suspend_reason && (
            <div className="bg-rose/5 border border-rose/20 rounded-2xl px-4 py-3 text-left">
              <p className="text-xs text-muted mb-1 font-medium">เหตุผล</p>
              <p className="text-sm text-text">{restaurant.suspend_reason}</p>
            </div>
          )}
          <p className="text-xs text-muted">หากต้องการอุทธรณ์ กรุณาติดต่อทีมงาน</p>
        </div>
      </div>
    )
  }

  return (
    <DashboardLangProvider>
      <div className="flex h-screen overflow-hidden">
        <DashboardSidebar
          slug={params.slug}
          restaurantName={restaurant.name}
          role={role}
          branches={restaurant.branches ?? []}
          parentSlug={restaurant.parent_slug ?? null}
          parentName={restaurant.parent_name ?? null}
        />
        <main className="flex-1 min-w-0 overflow-y-auto pt-14 pb-24 md:pt-0 md:pb-0">
          {children}
        </main>
        <PlanLimitModal />
      </div>
    </DashboardLangProvider>
  )
}
