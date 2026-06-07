import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/Providers'

export const metadata: Metadata = {
  title: 'Restaurant SaaS — ระบบจัดการร้านอาหาร',
  description: 'ระบบจัดการร้านอาหารครบวงจร สั่งผ่าน QR ครัวเรียลไทม์',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'KDS',
  },
}

export const viewport: Viewport = {
  themeColor: '#f97316',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Mitr:wght@400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icons/kds.svg" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(reg => {
                      reg.addEventListener('updatefound', () => {
                        const worker = reg.installing
                        if (worker) worker.addEventListener('statechange', () => {
                          if (worker.state === 'installed' && navigator.serviceWorker.controller)
                            worker.postMessage({ type: 'SKIP_WAITING' })
                        })
                      })
                    })
                    .catch(function() {})
                })
              }
            `,
          }}
        />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  )
}
