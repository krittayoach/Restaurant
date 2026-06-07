import { notFound, redirect } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL!

async function resolveTable(qrToken: string, slug: string) {
  const res = await fetch(`${API}/tables/resolve/${qrToken}?slug=${slug}`, { cache: 'no-store' })
  return res.ok ? res.json() : null
}

export default async function TablePage({ params }: { params: { slug: string; qrToken: string } }) {
  const table = await resolveTable(params.qrToken, params.slug)
  if (!table) notFound()
  redirect(`/r/${params.slug}/table/${params.qrToken}/order`)
}
