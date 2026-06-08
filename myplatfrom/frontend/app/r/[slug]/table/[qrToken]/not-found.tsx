'use client'
import { QrCode, ArrowLeft } from 'lucide-react'
import { useI18n, LangToggle } from '@/lib/i18n'

export default function QRNotFound() {
  const { t, lang, setLang } = useI18n()

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="flex justify-end mb-4">
          <LangToggle lang={lang} setLang={setLang} />
        </div>
        <div className="w-20 h-20 rounded-3xl bg-rose/10 flex items-center justify-center mx-auto mb-6">
          <QrCode size={36} className="text-rose" />
        </div>
        <h1 className="font-display font-bold text-2xl text-text mb-2">{t.invalidQR}</h1>
        <p className="text-muted text-sm leading-relaxed mb-8">
          {t.qrNotFound}<br />
          {t.scanAgain}
        </p>
        <a href="/" className="inline-flex items-center gap-2 text-accent font-semibold text-sm hover:underline">
          <ArrowLeft size={16} /> {t.backHome}
        </a>
      </div>
    </div>
  )
}
