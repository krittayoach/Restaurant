import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify } from 'jose'
import DashboardSidebar from '@/components/DashboardSidebar'

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
  const restaurant = res.ok ? await res.json() : { name: params.slug }

  return (
    <div className="flex h-screen overflow-hidden">
      <DashboardSidebar slug={params.slug} restaurantName={restaurant.name} role={role} />
      <main className="flex-1 min-w-0 overflow-y-auto pt-14 pb-24 md:pt-0 md:pb-0">
        {children}
      </main>
    </div>
  )
}
