import { cookies } from 'next/headers'
import OverviewContent from '@/components/OverviewContent'

const API = process.env.NEXT_PUBLIC_API_URL!

export default async function ManagerDashboard({ params }: { params: { slug: string } }) {
  const token = cookies().get('session')?.value ?? ''
  const [weekly, bestseller] = await Promise.all([
    fetch(`${API}/reports/sales/weekly`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }).then(r => r.ok ? r.json() : []),
    fetch(`${API}/reports/menu/bestseller`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }).then(r => r.ok ? r.json() : []),
  ])

  return <OverviewContent slug={params.slug} weekly={weekly} bestseller={bestseller} />
}
